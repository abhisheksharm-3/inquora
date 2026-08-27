import { describe, expect, it } from "vitest";
import { err, isOk, ok, unwrapOr, type Result } from "./result";

describe("Result", () => {
  it("wraps a success value", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("wraps a failure value", () => {
    const r = err("boom");
    expect(r).toEqual({ ok: false, error: "boom" });
  });

  it("narrows the type through isOk", () => {
    const r: Result<number, string> = ok(1);
    if (isOk(r)) {
      expect(r.value + 1).toBe(2);
    } else {
      throw new Error("isOk should have narrowed to the success branch");
    }
  });

  it("returns the fallback for a failure", () => {
    expect(unwrapOr(err("boom") as Result<number, string>, 7)).toBe(7);
  });

  it("returns the value for a success", () => {
    expect(unwrapOr(ok(3) as Result<number, string>, 7)).toBe(3);
  });
});
