import { createExecutionContext, createScheduledController } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { scheduledHandler } from "../worker/handlers/scheduled.js";

describe("scheduled handler failures", () => {
  it("rejects when reminder processing fails so the invocation is observable", async () => {
    const controller = createScheduledController({
      scheduledTime: Date.parse("2026-09-06T01:00:00.000Z"),
      cron: "* * * * *",
    });

    await expect(
      scheduledHandler(controller, { DB: null }, createExecutionContext())
    ).rejects.toThrow();
  });
});
