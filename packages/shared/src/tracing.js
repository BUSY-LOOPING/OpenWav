import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export function startTracing(serviceName) {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return null;
  process.env.OTEL_SERVICE_NAME ||= serviceName;
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })],
  });
  sdk.start();
  process.once('SIGTERM', () => sdk.shutdown().catch(() => {}));
  return sdk;
}
