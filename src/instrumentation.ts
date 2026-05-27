/**
 * Next.js instrumentation hook — called ONCE on server boot before any
 * request is served. We use it to wire OpenTelemetry traces (spans →
 * OTLP HTTP → Collector → Tempo) and bind `@event-sorcerer/telemetry`
 * so framework operations (publish, load, projection apply) show up as
 * spans in Grafana.
 *
 * Metrics (prom-client via `@event-sorcerer/metrics-prometheus`) are
 * already wired in `src/sorc.ts` and exposed at `/api/metrics` — that
 * path goes through Prometheus's scheduled scrape, NOT through OTel.
 */
export async function register() {
    // Next.js' instrumentation runs in BOTH the Node.js runtime AND the
    // Edge runtime. OTel SDK only works in Node — bail out elsewhere.
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    // Opt-out for local dev / tests where the OTel Collector may not be up.
    if (process.env.FINANCES_TELEMETRY === 'off') {
        console.log('📊 telemetry: disabled via FINANCES_TELEMETRY=off');
        return;
    }

    const { diag, DiagConsoleLogger, DiagLogLevel } = await import(
        '@opentelemetry/api'
    );
    if (process.env.FINANCES_TELEMETRY_DEBUG === '1') {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import(
        '@opentelemetry/auto-instrumentations-node'
    );
    const { OTLPTraceExporter } = await import(
        '@opentelemetry/exporter-trace-otlp-http'
    );
    const { Resource } = await import('@opentelemetry/resources');
    const {
        SEMRESATTRS_SERVICE_NAME,
        SEMRESATTRS_SERVICE_VERSION,
        SEMRESATTRS_SERVICE_NAMESPACE,
    } = await import('@opentelemetry/semantic-conventions');
    const { EventSorcererInstrumentation } = await import(
        '@event-sorcerer/telemetry'
    );

    const otlpBase =
        process.env.FINANCES_OTLP_BASE ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        'http://otel-collector:4318';
    const otlpTracesUrl =
        process.env.FINANCES_OTLP_TRACES_URL ?? `${otlpBase}/v1/traces`;

    const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'example-finances',
        [SEMRESATTRS_SERVICE_VERSION]: '0.1.0',
        [SEMRESATTRS_SERVICE_NAMESPACE]: 'event-sorcerer',
    });

    const eventSorcererInstrumentation = new EventSorcererInstrumentation({
        capturePayload: false,
        captureStreamDetails: true,
    });

    const traceExporter = new OTLPTraceExporter({
        url: otlpTracesUrl,
        headers: { 'Content-Type': 'application/json' },
        timeoutMillis: 30000,
    });

    const sdk = new NodeSDK({
        resource,
        traceExporter,
        instrumentations: [
            eventSorcererInstrumentation,
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-mongodb': { enabled: true },
                '@opentelemetry/instrumentation-http': { enabled: true },
                '@opentelemetry/instrumentation-fs': { enabled: false },
                '@opentelemetry/instrumentation-dns': { enabled: false },
            }),
        ],
    });

    sdk.start();
    // EventSorcererInstrumentation patches require_cache lookups; enabling
    // it AFTER NodeSDK.start() ensures the patches take effect on modules
    // loaded by this instrumentation file (parity with the bench setup).
    setTimeout(() => eventSorcererInstrumentation.enable(), 100);

    // Graceful flush on shutdown so the trace tail doesn't get dropped.
    const shutdown = async () => {
        try {
            await sdk.shutdown();
        } catch (err) {
            console.error('telemetry shutdown error', err);
        }
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

    console.log(`📊 telemetry: OTLP traces → ${otlpTracesUrl}`);
}
