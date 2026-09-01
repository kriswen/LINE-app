import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { claimDelivery, completeDelivery } from "../worker/db/delivery-log.js";

describe("routine delivery retry", () => {
  it("retries a previously failed delivery and skips a healthy one", async () => {
    const entry = {
      reminder_type: "routine",
      reminder_id: "routine-1",
      scheduled_for: "2026-09-01T09:00:00+08:00",
      subscriber_id: "group-1",
    };

    expect(await claimDelivery(env.DB, entry)).toBe(true);
    await completeDelivery(env.DB, entry, "failed", "network down");
    const afterFail = await claimDelivery(env.DB, entry);
    expect(afterFail).toBe(true);

    await completeDelivery(env.DB, entry, "success");
    const afterSuccess = await claimDelivery(env.DB, entry);
    expect(afterSuccess).toBe(false);
  });
});
