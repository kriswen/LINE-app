import { describe, expect, it } from "vitest";
import { isDayMatch } from "../worker/utils/timezone.js";

describe("Taipei weekday matching", () => {
  it("uses the Taipei weekday when UTC is still on the previous day", () => {
    const saturdayUtcSundayTaipei = new Date("2026-09-05T16:30:00.000Z");

    expect(isDayMatch([0], saturdayUtcSundayTaipei)).toBe(true);
    expect(isDayMatch([6], saturdayUtcSundayTaipei)).toBe(false);
  });
});
