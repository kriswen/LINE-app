import { env } from "cloudflare:workers";
import { createExecutionContext, createScheduledController } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduledHandler } from "../worker/handlers/scheduled.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routine scheduling", () => {
  it("uses the scheduled event time and sends each occurrence once", async () => {
    await env.DB.prepare(
      `INSERT INTO reminder_routines
       (id, time, days_of_week, message, include_medicine, enabled)
       VALUES (?, ?, ?, ?, 1, 1)`
    )
      .bind("routine-1", "09:00", "[0]", "Take medicine")
      .run();
    await env.DB.prepare(
      `INSERT INTO subscribers (id, line_target_id, target_type, active)
       VALUES (?, ?, 'group', 1)`
    )
      .bind("subscriber-1", "group-1")
      .run();

    const lineFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", lineFetch);
    const scheduledTime = Date.parse("2026-09-06T01:00:00.000Z");

    await scheduledHandler(
      createScheduledController({ scheduledTime, cron: "* * * * *" }),
      env,
      createExecutionContext()
    );
    await scheduledHandler(
      createScheduledController({ scheduledTime, cron: "* * * * *" }),
      env,
      createExecutionContext()
    );

    expect(lineFetch).toHaveBeenCalledTimes(1);
    const delivery = await env.DB.prepare(
      `SELECT status FROM delivery_log WHERE claim_key IS NOT NULL`
    ).all();
    expect(delivery.results).toEqual([{ status: "success" }]);
  });
});
