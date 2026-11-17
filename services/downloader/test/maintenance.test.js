import { describe, expect, it } from 'vitest';
import { createYtdlpMaintenance } from '../src/maintenance.js';

const fakeRedis = () => {
  const store = new Map();
  return { store, set: async (k, v) => store.set(k, v) };
};
const logger = { warn: () => {} };

describe('yt-dlp maintenance', () => {
  it('reports the installed and latest versions', async () => {
    const redis = fakeRedis();
    const m = createYtdlpMaintenance({ redis, logger, exec: async () => ({ stdout: '2025.01.01\n' }), latest: async () => '2025.02.01' });
    expect(await m.report()).toMatchObject({ version: '2025.01.01', latest: '2025.02.01', updating: false });
    expect(JSON.parse(redis.store.get('ytdlp:status')).version).toBe('2025.01.01');
  });

  it('upgrades into the user site and records failures without throwing', async () => {
    const calls = [];
    let installed = '2025.01.01';
    const exec = async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === 'pip3') {
        installed = '2025.02.01';
        return { stdout: 'Successfully installed yt-dlp-2025.2.1' };
      }
      return { stdout: installed };
    };
    const m = createYtdlpMaintenance({ redis: fakeRedis(), logger, exec, latest: async () => '2025.02.01' });
    const after = await m.update();
    expect(calls.find((c) => c[0] === 'pip3')).toEqual(expect.arrayContaining(['install', '--user', '--upgrade']));
    expect(after).toMatchObject({ version: '2025.02.01', updating: false, lastUpdate: { ok: true } });

    const broken = createYtdlpMaintenance({ redis: fakeRedis(), logger, exec: async (cmd) => (cmd === 'pip3' ? Promise.reject(Object.assign(new Error('x'), { stderr: 'no network' })) : { stdout: '1' }), latest: async () => '2' });
    expect((await broken.update()).lastUpdate).toMatchObject({ ok: false, output: 'no network' });
  });
});
