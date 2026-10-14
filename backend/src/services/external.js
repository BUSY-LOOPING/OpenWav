const fetchJson = async (url, { timeoutMs = 3000, ...init } = {}) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
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
    search: (q, limit = 10) =>
      cached(`scraper:search:${limit}:${q.toLowerCase().trim()}`, () =>
        fetchJson(`${baseUrl}/search?filter=songs&limit=${limit}&q=${encodeURIComponent(q)}`, { timeoutMs: 10_000 }).then((r) => r.items),
      ),
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

export function createMonitoring({ prometheusUrl, alertmanagerUrl }) {
  const quantile = async (q) => {
    const query = `histogram_quantile(${q}, sum by (le) (rate(http_request_duration_seconds_bucket{service="backend"}[5m])))`;
    const data = await fetchJson(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
    const value = Number(data?.data?.result?.[0]?.value?.[1]);
    return Number.isFinite(value) ? Math.round(value * 1000) : null;
  };
  const errorRate = async () => {
    const query = 'sum(rate(http_request_duration_seconds_count{service="backend",status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count{service="backend"}[5m]))';
    const data = await fetchJson(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
    const value = Number(data?.data?.result?.[0]?.value?.[1]);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    latency: async () => {
      const [p95Ms, p99Ms, rate] = await Promise.all([quantile(0.95), quantile(0.99), errorRate()]).catch(() => [null, null, null]);
      return { p95Ms, p99Ms, errorRate: rate };
    },
    alerts: () => fetchJson(`${alertmanagerUrl}/api/v2/alerts?active=true`).catch(() => []),
  };
}

export { fetchJson };
