import { env } from "cloudflare:workers";
import { createExecutionContext, createScheduledController } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { scheduledHandler } from "../worker/handlers/scheduled.js";

describe("one-off delivery without subscribers", () => {
  it("marks the reminder failed instead of falsely reporting it sent", async () => {
    await env.DB.prepare(
      `INSERT INTO oneoff_reminders (id, scheduled_at, message, status)
       VALUES ('oneoff-no-subs', '2026-09-01T00:00:00.000Z', 'test', 'pending')`
    ).run();

    const controller = createScheduledController({
      scheduledTime: new Date("2026-09-01T00:01:00.000Z").getTime(),
      cron: "* * * * *",
    });
    await scheduledHandler(controller, env, createExecutionContext());

    const row = await env.DB.prepare(
      "SELECT status, error_message FROM oneoff_reminders WHERE id = 'oneoff-no-subs'"
    ).first();
    expect(row).toMatchObject({
      status: "failed",
      error_message: "No active subscribers",
    });
  });
});
