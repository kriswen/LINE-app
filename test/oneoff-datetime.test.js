import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../worker/index.js";

async function postOneoff(datetime) {
  return worker.fetch(
    new Request("https://example.com/api/oneoff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-password": "admin123",
      },
      body: JSON.stringify({ datetime, message: "test" }),
    }),
    env,
    createExecutionContext()
  );
}

describe("one-off datetime validation", () => {
  it("rejects impossible calendar dates that would silently roll over", async () => {
    const response = await postOneoff("2027-02-30T10:00");
    expect(response.status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM oneoff_reminders").first();
    expect(count.count).toBe(0);
  });

  it("rejects malformed datetime formats", async () => {
    const response = await postOneoff("2027-13-01");
    expect(response.status).toBe(400);
  });

  it("accepts a valid future datetime", async () => {
    const response = await postOneoff("2030-01-01T09:00");
    expect(response.status).toBe(200);
  });
});
