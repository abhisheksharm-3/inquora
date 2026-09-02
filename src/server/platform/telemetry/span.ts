import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { SpanAttributes, SpanHandle, SpanName } from "./telemetry.types";

/**
 * A span, against OpenTelemetry rather than against a vendor.
 *
 * ADR 0004: instrument once, export to Sentry for exceptions and Langfuse for
 * LLM and retrieval traces. Both are OTLP endpoints, so adding, swapping or
 * dropping one is an exporter setting rather than a second instrumentation layer
 * threaded through the same call sites.
 *
 * When nothing is configured the tracer is a no-op the SDK provides, so this
 * costs an object allocation and changes no behaviour. That is the point: the
 * call sites do not ask whether telemetry is on.
 */
const tracer = () => trace.getTracer("inquora", "1.0.0");

export const startSpan = (name: SpanName, attributes: SpanAttributes = {}): SpanHandle => {
  const span = tracer().startSpan(name, { attributes: clean(attributes) });

  return {
    set(more) {
      span.setAttributes(clean(more));
    },
    fail(error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error) span.recordException(error);
    },
    end() {
      span.end();
    },
  };
};

/**
 * Wraps work in a span that ends whether the work throws or not. A span left open
 * is worse than no span: it never arrives, and the trace shows a gap.
 */
export const withSpan = async <T>(
  name: SpanName,
  attributes: SpanAttributes,
  work: (span: SpanHandle) => Promise<T>,
): Promise<T> => {
  const span = startSpan(name, attributes);

  try {
    return await work(span);
  } catch (error) {
    span.fail(error);
    throw error;
  } finally {
    span.end();
  }
};

/** OpenTelemetry rejects undefined values, and an absent attribute is not an error. */
const clean = (attributes: SpanAttributes) =>
  Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean>;
