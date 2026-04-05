const ical = require('node-ical');

/**
 * Normalizes a date to YYYY-MM-DD for straightforward string comparison.
 * @param {Date} date The date object to format.
 * @returns {string} Formatted string YYYY-MM-DD in Asia/Taipei timezone.
 */
function getTaipeiDateString(date) {
    return date.toLocaleString('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Fetches events from the public iCal feed.
 * @returns {Promise<Array>} List of all parsed events.
 */
async function fetchCalendarEvents() {
    let calendarUrl = process.env.CALENDAR_URL;

    // Fallback to construct from CALENDAR_ID if URL is missing
    if (!calendarUrl && process.env.CALENDAR_ID) {
        calendarUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(process.env.CALENDAR_ID)}/public/basic.ics`;
    }

    if (!calendarUrl) {
        console.warn("CALENDAR_URL or CALENDAR_ID is not set in Environment Variables.");
        return [];
    }

    try {
        // node-ical handles the HTTP fetching and parsing for us
        const data = await ical.async.fromURL(calendarUrl);

        // Filter out metadata, we only want the actual VEVENT items
        return Object.values(data).filter(item => item.type === 'VEVENT');
    } catch (err) {
        console.error("Error fetching or parsing iCal feed:", err.message);
        return [];
    }
}

/**
 * Main wrapper function to retrieve both +1 Day and +7 Day reminders.
 * @returns {Promise<string>} A formatted string block containing the reminders, or empty string if none.
 */
/**
 * Main wrapper function to retrieve both +1 Day and +7 Day reminders.
 * @returns {Promise<string>} A formatted string block containing the reminders, or empty string if none.
 */
async function getUpcomingCalendarReminders(days = 4, excludePast = true, excludeToday = false) {
    const realNow = new Date();

    // Create an array of target date strings for the specified number of days
    let targetDates = [];
    let startDay = excludeToday ? 1 : 0;

    for (let i = startDay; i < startDay + days; i++) {
        // Add exactly 24 hours per day to the absolute time.
        // Formatting this absolute time to Asia/Taipei will yield the correct exact date string.
        let d = new Date(realNow.getTime() + i * 24 * 60 * 60 * 1000);
        targetDates.push(getTaipeiDateString(d));
    }

    // Give rrule a wide ±2 day buffer to generate recurrences.
    // The actual rigid filtering is handled solely by targetDates.includes() below.
    let rangeStart = new Date(realNow.getTime() - 2 * 24 * 60 * 60 * 1000);
    let rangeEnd = new Date(realNow.getTime() + (startDay + days + 2) * 24 * 60 * 60 * 1000);

    const allEvents = await fetchCalendarEvents();
    if (allEvents.length === 0) {
        return `\n\n【未來 ${days} 天行程預告${excludeToday ? "" : " (含今日)"}】\n目前尚無行程安排`;
    }

    let upcomingEvents = [];

    for (const event of allEvents) {
        if (!event.start) continue;

        let datesToCheck = [];

        // Always include the original start date
        datesToCheck.push(event.start);

        // If the event recurs, calculate the recurrences inside our window
        if (event.rrule) {
            let recurrences = event.rrule.between(rangeStart, rangeEnd);
            for (let rDate of recurrences) {
                datesToCheck.push(rDate);
            }
        }

        let seenDates = new Set();
        for (const dateObj of datesToCheck) {
            const eventDateStr = getTaipeiDateString(dateObj);

            // Check if this specific date is an exception (deleted instance of a recurring event)
            let isException = false;
            const exdatesObj = event.exdate || event.exdates;
            if (exdatesObj) {
                for (const exKey of Object.keys(exdatesObj)) {
                    if (exKey.startsWith(eventDateStr)) {
                        isException = true;
                        break;
                    }
                }
            }
            if (isException) continue;

            // Prevent duplicates caused by mixing the original start date and rrule dates
            if (seenDates.has(eventDateStr)) continue;
            seenDates.add(eventDateStr);

            if (targetDates.includes(eventDateStr)) {
                let timeString = "全天 (All Day)";
                let isAllDay = false;
                if (!event.datetype || event.datetype !== 'date') {
                    timeString = dateObj.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' });
                } else {
                    isAllDay = true;
                }

                // If excludePast is true, skip events that have already passed in reality
                // Only filter non-all-day events. All-day events conceptually span the entire day.
                if (excludePast && !isAllDay && dateObj < realNow) {
                    continue;
                }

                // Format the display date cleanly (e.g. 3/3/2026)
                const displayDate = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', year: 'numeric' });
                const weekdayStr = dateObj.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', weekday: 'long' });

                const formattedString = `📅 ${displayDate}(${weekdayStr}) ${timeString} - ${event.summary}`;

                upcomingEvents.push({
                    date: dateObj,
                    text: formattedString
                });
            }
        }
    }

    if (upcomingEvents.length > 0) {
        // Sort the events chronologically
        upcomingEvents.sort((a, b) => a.date - b.date);

        const eventStrings = upcomingEvents.map(e => e.text);
        return `\n\n【未來 ${days} 天行程預告${excludeToday ? "" : " (含今日)"}】\n` + eventStrings.join("\n");
    }

    return `\n\n【未來 ${days} 天行程預告${excludeToday ? "" : " (含今日)"}】\n目前尚無行程安排`;
}

module.exports = { getUpcomingCalendarReminders };
