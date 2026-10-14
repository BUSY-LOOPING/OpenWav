import http from 'node:http';
import client from 'prom-client';

export const registry = new client.Registry();

export function initMetrics(service) {
  registry.setDefaultLabels({ service });
  client.collectDefaultMetrics({ register: registry });
  return registry;
}

export function histogram(name, help, labelNames = [], buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300]) {
  return new client.Histogram({ name, help, labelNames, buckets, registers: [registry] });
}

export function counter(name, help, labelNames = []) {
  return new client.Counter({ name, help, labelNames, registers: [registry] });
}

export function gauge(name, help, labelNames = []) {
  return new client.Gauge({ name, help, labelNames, registers: [registry] });
}

export async function metricsHandler(_req, res) {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}

export function startMetricsServer(port, healthCheck = async () => true) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') return metricsHandler(req, res);
    if (req.url === '/health') {
      const ok = await healthCheck().catch(() => false);
      res.statusCode = ok ? 200 : 503;
      return res.end(JSON.stringify({ status: ok ? 'ok' : 'unhealthy' }));
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port);
  return server;
}
