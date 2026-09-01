import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../worker/index.js";

async function authenticatedRequest(path, init = {}) {
  return worker.fetch(
    new Request(`https://example.com${path}`, {
      ...init,
      headers: {
        ...init.headers,
        "x-admin-password": "admin123",
      },
    }),
    env,
    createExecutionContext()
  );
}

async function authenticatedGet(path) {
  return authenticatedRequest(path);
}

describe("dashboard API response fields", () => {
  it("maps BP database columns to the dashboard field names", async () => {
    await env.DB.prepare(
      `INSERT INTO bp_logs
       (id, measured_date, systolic, diastolic, heart_rate, weight)
       VALUES ('bp-1', '2026-09-01', 120, 80, 70, 65.5)`
    ).run();

    const response = await authenticatedGet("/api/bp");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      logs: [
        {
          id: "bp-1",
          date: "2026-09-01",
          sys: 120,
          dia: 80,
          hr: 70,
          weight: 65.5,
        },
      ],
    });
  });

  it("rejects malformed blood-pressure records", async () => {
    const before = await env.DB.prepare("SELECT COUNT(*) AS count FROM bp_logs").first();
    const response = await authenticatedRequest("/api/bp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: "2026-02-30",
        sys: "not-a-number",
        dia: -1,
      }),
    });

    expect(response.status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM bp_logs").first();
    expect(count.count).toBe(before.count);
  });

  it("rejects malformed routine configuration", async () => {
    const response = await authenticatedRequest("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reminders: [
          {
            time: "25:99",
            daysOfWeek: [7],
            message: "",
            includeCalendarReminderDays: 99,
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM reminder_routines").first();
    expect(count.count).toBe(0);
  });

  it("rejects malformed one-off reminder datetimes", async () => {
    const response = await authenticatedRequest("/api/oneoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ datetime: "not-a-date", message: "hello" }),
    });

    expect(response.status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM oneoff_reminders").first();
    expect(count.count).toBe(0);
  });

  it("maps one-off database columns to the dashboard field names", async () => {
    await env.DB.prepare(
      `INSERT INTO oneoff_reminders
       (id, scheduled_at, message, status, attempts)
       VALUES ('oneoff-api-1', '2026-09-07T01:00:00.000Z', 'Appointment', 'pending', 0)`
    ).run();

    const response = await authenticatedGet("/api/oneoff");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reminders[0]).toMatchObject({
      id: "oneoff-api-1",
      datetime: "2026-09-07T01:00:00.000Z",
      message: "Appointment",
      status: "pending",
    });
    expect(body.reminders[0]).not.toHaveProperty("scheduled_at");
  });
});
