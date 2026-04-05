const cron = require('node-cron');
console.log("Current time:", new Date().toString());
const t = new Date(Date.now() + 65000); // 65 seconds from now
const min = t.getMinutes();
const hr = t.getHours();
console.log(`Scheduling for ${min} ${hr} * * * with Asia/Taipei`);
cron.schedule(`${min} ${hr} * * *`, () => {
  console.log("Job fired!");
  process.exit(0);
}, { timezone: "Asia/Taipei" });
