const ical = require('node-ical');
require('dotenv').config();

async function debugCalendar() {
    const calendarUrl = process.env.CALENDAR_URL;
    if (!calendarUrl) {
        console.error("CALENDAR_URL is not set");
        return;
    }

    try {
        console.log("Fetching: " + calendarUrl);
        const data = await ical.async.fromURL(calendarUrl);
        const events = Object.values(data).filter(item => item.type === 'VEVENT');

        console.log(`\nFound ${events.length} VEVENTs.\n`);

        for (const event of events) {
            // Only log events that have exdates
            if (event.exdate) {
                console.log("--- FOUND EXDATES ---");
                console.log("Summary:", event.summary);
                console.log("EXDATE Object:", event.exdate);
                console.log("Raw Keys:", Object.keys(event.exdate));

                for (const key of Object.keys(event.exdate)) {
                    console.log(`Key Type: ${typeof key}, Value: ${key}`);
                }
            } else if (event.exdates) { // Some parsers use exdates (plural)
                console.log("--- FOUND EXDATES (plural) ---");
                console.log("Summary:", event.summary);
                console.log("EXDATES Object:", event.exdates);
            }
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

debugCalendar();
