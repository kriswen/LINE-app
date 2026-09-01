import { afterEach, describe, expect, it, vi } from "vitest";
import { pushMessage } from "../worker/utils/line-api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LINE API failures", () => {
  it("rejects when LINE returns a non-success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid recipient", { status: 400 }))
    );

    await expect(
      pushMessage("token", "recipient", [{ type: "text", text: "hello" }])
    ).rejects.toThrow("LINE pushMessage failed (400): invalid recipient");
  });
});
