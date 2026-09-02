import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { claimPendingOneOffReminders } from "../worker/db/oneoff-reminders.js";

describe("one-off reminder claiming", () => {
  it("allows a due reminder to be claimed only once", async () => {
    await env.DB.prepare(
      `INSERT INTO oneoff_reminders
       (id, scheduled_at, message, status, attempts, created_at)
       VALUES (?, ?, ?, 'pending', 0, datetime('now'))`
    )
      .bind("oneoff-1", "2026-09-01T00:00:00.000Z", "Take medicine")
      .run();

    const firstClaim = await claimPendingOneOffReminders(
      env.DB,
      "2026-09-01T00:01:00.000Z"
    );
    const secondClaim = await claimPendingOneOffReminders(
      env.DB,
      "2026-09-01T00:01:00.000Z"
    );

    expect(firstClaim.map((item) => item.id)).toEqual(["oneoff-1"]);
    expect(secondClaim).toEqual([]);
  });
});
