/**
 * Instrumentation, once, against OpenTelemetry.
 *
 * ADR 0004: Sentry takes exceptions and request performance, Langfuse takes LLM
 * and retrieval traces. Both are OTLP endpoints — Sentry's SDK is built on
 * OpenTelemetry and Langfuse accepts OTLP directly — so this is one
 * instrumentation layer with two exporters rather than two vendor clients
 * threaded through the same call sites.
 *
 * Every backend is optional. A missing DSN means the tracer is the SDK's no-op
 * and the application answers questions exactly as before: telemetry that can
 * take down a request is worse than none.
 */
export async function register() {
  const { registerOTel } = await import("@vercel/otel").catch(() => ({ registerOTel: undefined }));

  const dsn = process.env.SENTRY_DSN;
  const langfusePublic = process.env.LANGFUSE_PUBLIC_KEY;
  const langfuseSecret = process.env.LANGFUSE_SECRET_KEY;

  if (dsn) {
    const Sentry = await import("@sentry/nextjs");

    Sentry.init({
      dsn,
      // Every trace, because the traffic is small and a sampled trace of an
      // answer that went wrong is the one you wanted.
      tracesSampleRate: 1,
      sendDefaultPii: false,
      environment: process.env.NODE_ENV,
    });
  }

  if (langfusePublic && langfuseSecret && registerOTel) {
    const base = process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com";
    const { OTLPHttpJsonTraceExporter } = await import("@vercel/otel");

    registerOTel({
      serviceName: "inquora",
      traceExporter: new OTLPHttpJsonTraceExporter({
        url: `${base}/api/public/otel/v1/traces`,
        headers: {
          authorization: `Basic ${Buffer.from(`${langfusePublic}:${langfuseSecret}`).toString("base64")}`,
        },
      }),
    });
  }
}

/**
 * Errors from a request, reported once. Next calls this for a route handler that
 * throws, which is the case a Result cannot cover because it never returned.
 */
export async function onRequestError(
  ...args: Parameters<NonNullable<Awaited<typeof import("@sentry/nextjs")>["captureRequestError"]>>
) {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
