const { getUpcomingCalendarReminders } = require('../src/calendar.js');
async function test() {
  const events = await getUpcomingCalendarReminders(4, true);
  console.log(events);
}
test();
