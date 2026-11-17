const fetchJson = async (url, { timeoutMs = 3000, ...init } = {}) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`${url} responded ${res.status}`), { status: res.status });
  return res.status === 204 ? null : res.json();
};

export function createScraper({ baseUrl, redis, ttlSec = 3600 }) {
  const cached = async (key, load) => {
    const hit = await redis?.get(key);
    if (hit) return JSON.parse(hit);
    const value = await load();
    await redis?.set(key, JSON.stringify(value), 'EX', ttlSec);
    return value;
  };
  return {
    search: (q, limit = 10, filter = 'songs') =>
      cached(`scraper:search:${filter}:${limit}:${q.toLowerCase().trim()}`, () =>
        fetchJson(`${baseUrl}/search?filter=${filter}&limit=${limit}&q=${encodeURIComponent(q)}`, { timeoutMs: 10_000 }).then((r) => r.items),
      ),
    related: (videoId) =>
      cached(`scraper:related:${videoId}`, () => fetchJson(`${baseUrl}/related?videoId=${encodeURIComponent(videoId)}`, { timeoutMs: 10_000 }).then((r) => r.items)),
    playlist: (id) => cached(`scraper:playlist:${id}`, () => fetchJson(`${baseUrl}/playlist?id=${encodeURIComponent(id)}`, { timeoutMs: 15_000 }).then((r) => r.item)),
    suggestions: (q) =>
      cached(`scraper:suggest:${q.toLowerCase().trim()}`, () => fetchJson(`${baseUrl}/suggestions?q=${encodeURIComponent(q)}`, { timeoutMs: 3000 }).then((r) => r.items)),
    health: () => fetchJson(`${baseUrl}/health`, { timeoutMs: 1000 }),
  };
}

export function createRecommender({ baseUrl }) {
  const get = (path) => fetchJson(`${baseUrl}${path}`, { timeoutMs: 800 }).then((r) => r.items.map((i) => i.mediaId));
  return {
    forUser: (userId, limit = 20) => get(`/recommendations/${userId}?limit=${limit}`),
    similar: (mediaId, limit = 20) => get(`/similar/${mediaId}?limit=${limit}`),
    retrain: () => fetchJson(`${baseUrl}/train`, { method: 'POST', timeoutMs: 2000 }),
    insights: () => fetchJson(`${baseUrl}/insights`, { timeoutMs: 5000 }),
    health: () => fetchJson(`${baseUrl}/health`, { timeoutMs: 1000 }),
  };
}

export function createLyrics({ redis }) {
  return {
    async find({ title, artist, durationSec }) {
      const key = `lyrics:${artist}:${title}`.toLowerCase();
      const cached = await redis?.get(key);
      if (cached) return JSON.parse(cached);
      const params = new URLSearchParams({ track_name: title, artist_name: artist ?? '', ...(durationSec ? { duration: String(durationSec) } : {}) });
      const data = await fetchJson(`https://lrclib.net/api/get?${params}`, { timeoutMs: 4000 }).catch(() => null);
      const result = { plain: data?.plainLyrics ?? null, synced: data?.syncedLyrics ?? null };
      await redis?.set(key, JSON.stringify(result), 'EX', data ? 7 * 86_400 : 3600);
      return result;
    },
  };
}

const REAL_FS = 'fstype!~"tmpfs|devtmpfs|overlay|squashfs|efivarfs|vfat|ramfs|nsfs|autofs|fuse.*"';
const NIC = 'device!~"lo|veth.*|br-.*|docker.*"';

export function createMonitoring({ prometheusUrl, alertmanagerUrl, tempoUrl, lokiUrl }) {
  const vector = async (query) => (await fetchJson(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`))?.data?.result ?? [];
  const scalar = async (query) => {
    const value = Number((await vector(query))[0]?.value?.[1]);
    return Number.isFinite(value) ? value : null;
  };
  const quantile = async (q) => {
    const value = await scalar(`histogram_quantile(${q}, sum by (le) (rate(http_request_duration_seconds_bucket{service="backend"}[5m])))`);
    return value === null ? null : Math.round(value * 1000);
  };
  const errorRate = async () =>
    (await scalar('sum(rate(http_request_duration_seconds_count{service="backend",status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count{service="backend"}[5m]))')) ?? 0;

  async function server() {
    const [cpu, cores, load1, memTotal, memAvailable, swapTotal, swapFree, uptime, rx, tx, sizes, avails] = await Promise.all([
      scalar('1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))'),
      scalar('count(node_cpu_seconds_total{mode="idle"})'),
      scalar('node_load1'),
      scalar('node_memory_MemTotal_bytes'),
      scalar('node_memory_MemAvailable_bytes'),
      scalar('node_memory_SwapTotal_bytes'),
      scalar('node_memory_SwapFree_bytes'),
      scalar('time() - node_boot_time_seconds'),
      scalar(`sum(rate(node_network_receive_bytes_total{${NIC}}[5m]))`),
      scalar(`sum(rate(node_network_transmit_bytes_total{${NIC}}[5m]))`),
      vector(`node_filesystem_size_bytes{${REAL_FS}}`),
      vector(`node_filesystem_avail_bytes{${REAL_FS}}`),
    ]);
    const avail = new Map(avails.map((r) => [r.metric.mountpoint, Number(r.value[1])]));
    const byDevice = new Map();
    for (const r of [...sizes].sort((a, b) => a.metric.mountpoint.length - b.metric.mountpoint.length)) {
      if (byDevice.has(r.metric.device)) continue;
      byDevice.set(r.metric.device, { mount: r.metric.mountpoint, device: r.metric.device, fstype: r.metric.fstype, sizeBytes: Number(r.value[1]), availBytes: avail.get(r.metric.mountpoint) ?? null });
    }
    return {
      cpu: { usage: cpu, cores, load1 },
      memory: { totalBytes: memTotal, availableBytes: memAvailable },
      swap: { totalBytes: swapTotal, freeBytes: swapFree },
      uptimeSec: uptime,
      network: { rxBytesPerSec: rx, txBytesPerSec: tx },
      disks: [...byDevice.values()].sort((a, b) => a.mount.localeCompare(b.mount)),
    };
  }

  async function traces({ service, minDurationMs, limit, sinceSec }) {
    const now = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({ limit: String(limit), start: String(now - sinceSec), end: String(now) });
    if (service) params.set('tags', `service.name=${service}`);
    if (minDurationMs) params.set('minDuration', `${minDurationMs}ms`);
    const data = await fetchJson(`${tempoUrl}/api/search?${params}`, { timeoutMs: 5000 });
    return (data?.traces ?? [])
      .map((t) => ({ traceId: t.traceID, service: t.rootServiceName ?? null, name: t.rootTraceName ?? null, startedAt: new Date(Number(BigInt(t.startTimeUnixNano ?? 0) / 1_000_000n)).toISOString(), durationMs: t.durationMs ?? 0 }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async function logs({ service, errorsOnly, search, limit, sinceSec }) {
    const selector = `{service=~"${service ?? '.+'}"${errorsOnly ? ', level=~"(?i)error|fatal|critical"' : ''}}`;
    const query = search ? `${selector} |= ${JSON.stringify(search)}` : selector;
    const params = new URLSearchParams({ query, limit: String(limit), direction: 'backward', start: `${(Date.now() - sinceSec * 1000) * 1_000_000}` });
    const data = await fetchJson(`${lokiUrl}/loki/api/v1/query_range?${params}`, { timeoutMs: 5000 });
    return (data?.data?.result ?? [])
      .flatMap((stream) => stream.values.map(([ns, line]) => ({ at: new Date(Number(BigInt(ns) / 1_000_000n)).toISOString(), service: stream.stream.service ?? null, level: stream.stream.level ?? null, line })))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }

  return {
    traces,
    logs,
    latency: async () => {
      const [p95Ms, p99Ms, rate] = await Promise.all([quantile(0.95), quantile(0.99), errorRate()]).catch(() => [null, null, null]);
      return { p95Ms, p99Ms, errorRate: rate };
    },
    server,
    alerts: () => fetchJson(`${alertmanagerUrl}/api/v2/alerts?active=true`).catch(() => []),
  };
}

export { fetchJson };
