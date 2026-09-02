import type { Result } from "@/core/result.types";

/**
 * Arithmetic the model can trust, evaluated by a small recursive-descent parser.
 *
 * Not `eval`, not `new Function`, and not a dependency: the grammar is four
 * operators and parentheses, the input arrives from a language model, and
 * anything that can execute is a remote code execution hole in a chat box.
 */

const NOT_ARITHMETIC =
  "That is not an arithmetic expression. Use numbers, + - * / ^ and parentheses.";

/** Numbers, operators, parentheses and whitespace. Anything else is rejected whole. */
const ALLOWED = /^[\d\s.+\-*/^()]+$/;

export const evaluateArithmetic = (expression: string): Result<number, string> => {
  if (!ALLOWED.test(expression)) return { ok: false, error: NOT_ARITHMETIC };

  const tokens = expression.match(/\d+\.?\d*|[+\-*/^()]/g);
  if (!tokens) return { ok: false, error: NOT_ARITHMETIC };

  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];

  /** factor := number | '(' expr ')' | '-' factor */
  const factor = (): number => {
    const token = take();

    if (token === "-") return -factor();

    if (token === "(") {
      const value = expr();
      if (take() !== ")") throw new Error("unbalanced parentheses");
      return value;
    }

    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("expected a number");
    return value;
  };

  /** power := factor ('^' power)?  — right-associative, as arithmetic notation is */
  const power = (): number => {
    const base = factor();
    if (peek() !== "^") return base;
    take();
    return base ** power();
  };

  /** term := power (('*' | '/') power)* */
  const term = (): number => {
    let value = power();

    while (peek() === "*" || peek() === "/") {
      const operator = take();
      const right = power();

      if (operator === "/") {
        if (right === 0) throw new Error("division by zero");
        value /= right;
      } else {
        value *= right;
      }
    }

    return value;
  };

  /** expr := term (('+' | '-') term)* */
  const expr = (): number => {
    let value = term();

    while (peek() === "+" || peek() === "-") {
      value = take() === "+" ? value + term() : value - term();
    }

    return value;
  };

  try {
    const value = expr();

    if (position !== tokens.length) return { ok: false, error: NOT_ARITHMETIC };
    if (!Number.isFinite(value)) return { ok: false, error: "That does not have a finite answer." };

    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message === "division by zero"
          ? "That divides by zero."
          : NOT_ARITHMETIC,
    };
  }
};
