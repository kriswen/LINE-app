import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { claimDelivery } from "../worker/db/delivery-log.js";

describe("scheduled delivery idempotency", () => {
  it("claims a reminder occurrence for a subscriber only once", async () => {
    const entry = {
      reminder_type: "routine",
      reminder_id: "routine-1",
      scheduled_for: "2026-09-06T09:00:00+08:00",
      subscriber_id: "group-1",
    };

    expect(await claimDelivery(env.DB, entry)).toBe(true);
    expect(await claimDelivery(env.DB, entry)).toBe(false);

    const row = await env.DB.prepare(
      `SELECT status FROM delivery_log
       WHERE reminder_type = ? AND reminder_id = ?
         AND scheduled_for = ? AND subscriber_id = ?`
    )
      .bind(
        entry.reminder_type,
        entry.reminder_id,
        entry.scheduled_for,
        entry.subscriber_id
      )
      .all();

    expect(row.results).toEqual([{ status: "sending" }]);
  });
});
