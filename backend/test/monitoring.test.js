import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMonitoring } from '../src/services/external.js';

const monitoring = createMonitoring({ prometheusUrl: 'http://prom', alertmanagerUrl: 'http://am', tempoUrl: 'http://tempo', lokiUrl: 'http://loki' });
const respond = (body) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
const calledUrl = () => new URL(fetch.mock.calls[0][0]);

afterEach(() => vi.unstubAllGlobals());

describe('monitoring', () => {
  it('quotes free-text log searches so they cannot change the LogQL query', async () => {
    respond({ data: { result: [{ stream: { service: 'backend', level: 'error' }, values: [['1700000000000000000', '{"msg":"boom"}']] }] } });
    const lines = await monitoring.logs({ service: 'backend', errorsOnly: true, search: 'a" } |= "b', limit: 10, sinceSec: 60 });
    expect(calledUrl().searchParams.get('query')).toBe('{service=~"backend", level=~"(?i)error|fatal|critical"} |= "a\\" } |= \\"b"');
    expect(lines).toEqual([{ at: '2023-11-14T22:13:20.000Z', service: 'backend', level: 'error', line: '{"msg":"boom"}' }]);
  });

  it('maps Tempo search results newest first', async () => {
    respond({ traces: [{ traceID: 'a', rootServiceName: 'backend', rootTraceName: 'GET /x', startTimeUnixNano: '1700000000000000000', durationMs: 5 }, { traceID: 'b', startTimeUnixNano: '1700000001000000000', durationMs: 9 }] });
    const traces = await monitoring.traces({ service: 'backend', minDurationMs: 100, limit: 5, sinceSec: 60 });
    expect(Object.fromEntries(calledUrl().searchParams)).toMatchObject({ tags: 'service.name=backend', minDuration: '100ms', limit: '5' });
    expect(traces.map((t) => t.traceId)).toEqual(['b', 'a']);
  });

  it('keeps one entry per disk and reports free space', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const q = new URL(url).searchParams.get('query');
        const fs = (v) => [
          { metric: { mountpoint: '/', device: '/dev/sda2', fstype: 'ext4' }, value: [0, v] },
          { metric: { mountpoint: '/var/snap', device: '/dev/sda2', fstype: 'ext4' }, value: [0, v] },
          { metric: { mountpoint: '/mnt/hdd1', device: '/dev/sdb2', fstype: 'ext4' }, value: [0, v] },
        ];
        const result = q.startsWith('node_filesystem_size') ? fs('100') : q.startsWith('node_filesystem_avail') ? fs('25') : [{ value: [0, '4'] }];
        return { ok: true, status: 200, json: async () => ({ data: { result } }) };
      }),
    );
    const server = await monitoring.server();
    expect(server.disks).toEqual([
      { mount: '/', device: '/dev/sda2', fstype: 'ext4', sizeBytes: 100, availBytes: 25 },
      { mount: '/mnt/hdd1', device: '/dev/sdb2', fstype: 'ext4', sizeBytes: 100, availBytes: 25 },
    ]);
    expect(server.cpu.cores).toBe(4);
  });
});
