import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../worker/index.js";

describe("dashboard API origin policy", () => {
  it("does not enable cross-origin browser access by default", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/keep-alive", {
        headers: { Origin: "https://attacker.example" },
      }),
      env,
      createExecutionContext()
    );

    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });
});
