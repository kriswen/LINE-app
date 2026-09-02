import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  createReminderRoutine,
  getAllReminderRoutines,
  replaceAllReminderRoutines,
} from "../worker/db/reminder-routines.js";

const validRoutine = {
  time: "09:00",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  message: "original",
  includeMedicineReminder: true,
  includeWeather: false,
  includeCalendarReminder: false,
  includeCalendarReminderDays: 4,
  excludePastCalendarEvents: true,
  excludeTodayCalendarEvents: false,
};

describe("routine configuration replacement", () => {
  it("preserves the existing configuration when a replacement insert fails", async () => {
    await createReminderRoutine(env.DB, validRoutine);

    await expect(
      replaceAllReminderRoutines(env.DB, [
        { ...validRoutine, message: Symbol("invalid D1 binding") },
      ])
    ).rejects.toThrow();

    const routines = await getAllReminderRoutines(env.DB);
    expect(routines).toHaveLength(1);
    expect(routines[0].message).toBe("original");
  });
});
