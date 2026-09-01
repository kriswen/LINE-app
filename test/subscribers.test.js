import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getSubscribers, saveSubscriber } from "../worker/db/subscribers.js";

describe("subscriber registration", () => {
  it("reactivates an existing inactive LINE target", async () => {
    await env.DB.prepare(
      `INSERT INTO subscribers (id, line_target_id, target_type, active)
       VALUES ('sub-inactive', 'group-123', 'group', 0)`
    ).run();

    await saveSubscriber(env.DB, "group-123", "group");

    expect(await getSubscribers(env.DB)).toContain("group-123");
    const row = await env.DB.prepare(
      "SELECT active, target_type FROM subscribers WHERE line_target_id = 'group-123'"
    ).first();
    expect(row).toMatchObject({ active: 1, target_type: "group" });
  });
});
