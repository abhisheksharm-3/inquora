import { describe, expect, it } from "vitest";
import { formatWhen } from "./document.format";

/**
 * These exist because the first version of `formatWhen` reported one day as
 * "2 weeks ago". It paired each unit with the wrong divisor — minutes divided
 * by 24 to reach hours, hours by 7 to reach days — so the error compounded, and
 * every timestamp in the product was wrong in the direction that makes work
 * done yesterday look abandoned.
 */
describe("formatWhen", () => {
  const now = Date.parse("2026-09-03T12:00:00Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  it("says nothing precise about the last minute", () => {
    expect(formatWhen(ago(5), now)).toBe("just now");
    expect(formatWhen(ago(59), now)).toBe("just now");
  });

  it("counts minutes and hours", () => {
    expect(formatWhen(ago(2 * minute), now)).toBe("2 minutes ago");
    expect(formatWhen(ago(59 * minute), now)).toBe("59 minutes ago");
    expect(formatWhen(ago(hour), now)).toBe("1 hour ago");
    expect(formatWhen(ago(5 * hour), now)).toBe("5 hours ago");
  });

  it("reports one day as yesterday, not as two weeks", () => {
    expect(formatWhen(ago(day), now)).toBe("yesterday");
    expect(formatWhen(ago(3 * day), now)).toBe("3 days ago");
  });

  it("counts weeks and months", () => {
    expect(formatWhen(ago(week), now)).toBe("last week");
    expect(formatWhen(ago(3 * week), now)).toBe("3 weeks ago");
    expect(formatWhen(ago(10 * week), now)).toBe("2 months ago");
  });

  it("counts years", () => {
    expect(formatWhen(ago(70 * week), now)).toBe("last year");
  });

  it("never reports the future for a clock that is slightly behind", () => {
    expect(formatWhen(ago(-30), now)).toBe("just now");
  });
});
