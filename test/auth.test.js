import { describe, expect, it, vi } from "vitest";
import { authenticateAdmin } from "../worker/middleware/auth.js";

describe("admin authentication configuration", () => {
  it("fails closed with a service error when the password hash secret is missing", async () => {
    const context = {
      req: { header: () => "admin123" },
      env: {},
      json: (body, status) => ({ body, status }),
    };
    const next = vi.fn();

    const response = await authenticateAdmin(context, next);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "Admin authentication is not configured" });
    expect(next).not.toHaveBeenCalled();
  });
});
