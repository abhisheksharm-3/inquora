import { describe, expect, it } from "vitest";
import { evaluateArithmetic } from "./arithmetic";

const value = (expression: string) => {
  const result = evaluateArithmetic(expression);
  if (!result.ok) throw new Error(`expected a number, got: ${result.error}`);
  return result.value;
};

describe("evaluateArithmetic", () => {
  it("adds, subtracts, multiplies and divides", () => {
    expect(value("2 + 3 * 4")).toBe(14);
    expect(value("(2 + 3) * 4")).toBe(20);
    expect(value("10 / 4")).toBe(2.5);
    expect(value("10 - 4 - 3")).toBe(3);
  });

  it("computes a percentage change the way a reader would check it", () => {
    expect(value("(4.68 - 4.12) / 4.68 * 100")).toBeCloseTo(11.9658, 3);
  });

  it("handles a leading minus", () => {
    expect(value("-5 + 2")).toBe(-3);
  });

  it("raises to a power", () => {
    expect(value("2 ^ 10")).toBe(1024);
  });

  it("refuses anything that is not arithmetic", () => {
    for (const attempt of ["process.exit(1)", "1; drop table users", "alert('x')", "2 + foo"]) {
      const result = evaluateArithmetic(attempt);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.toLowerCase()).toContain("arithmetic");
    }
  });

  it("refuses an unbalanced expression rather than guessing", () => {
    expect(evaluateArithmetic("(2 + 3").ok).toBe(false);
  });

  it("reports division by zero rather than returning Infinity", () => {
    const result = evaluateArithmetic("1 / 0");
    expect(result.ok).toBe(false);
  });
});

describe("evaluateArithmetic, regressions found in review", () => {
  it("reads a leading decimal point rather than dropping it", () => {
    // ".5 * 4" tokenized as 5 * 4 and returned 20 — a wrong number from the tool
    // that exists so numbers are not guessed.
    expect(value(".5*4")).toBe(2);
    expect(value(".25+.25")).toBe(0.5);
    expect(value("-.5")).toBe(-0.5);
  });

  it("still agrees with the explicit form", () => {
    expect(value(".5*4")).toBe(value("0.5*4"));
  });
});
