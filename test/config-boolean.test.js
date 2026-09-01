import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../worker/index.js";

async function postConfig(reminders) {
  return worker.fetch(
    new Request("https://example.com/api/config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-password": "admin123",
      },
      body: JSON.stringify({ reminders }),
    }),
    env,
    createExecutionContext()
  );
}

describe("routine configuration boolean validation", () => {
  it("rejects non-boolean truthy strings for boolean fields", async () => {
    const response = await postConfig([
      {
        time: "09:00",
        daysOfWeek: [1, 2, 3],
        message: "medicine",
        includeCalendarReminder: "false",
      },
    ]);
    expect(response.status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM reminder_routines").first();
    expect(count.count).toBe(0);
  });

  it("accepts a well-formed routine", async () => {
    const response = await postConfig([
      {
        time: "09:00",
        daysOfWeek: [1, 2, 3],
        message: "medicine",
        includeMedicineReminder: true,
        includeWeather: false,
        includeCalendarReminder: false,
        excludePastCalendarEvents: true,
        excludeTodayCalendarEvents: false,
      },
    ]);
    expect(response.status).toBe(200);
  });
});
