import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { updateOneOffReminderStatus } from "../worker/db/oneoff-reminders.js";

describe("one-off reminder failures", () => {
  it("persists an error message when delivery fails", async () => {
    await env.DB.prepare(
      `INSERT INTO oneoff_reminders
       (id, scheduled_at, message, status, attempts, created_at)
       VALUES (?, ?, ?, 'sending', 1, datetime('now'))`
    )
      .bind("oneoff-failed", "2026-09-01T00:00:00.000Z", "Take medicine")
      .run();

    await updateOneOffReminderStatus(
      env.DB,
      "oneoff-failed",
      "failed",
      "LINE rejected recipient"
    );

    const row = await env.DB.prepare(
      `SELECT status, error_message FROM oneoff_reminders WHERE id = ?`
    )
      .bind("oneoff-failed")
      .first();
    expect(row).toEqual({
      status: "failed",
      error_message: "LINE rejected recipient",
    });
  });
});
