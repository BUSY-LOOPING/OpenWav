import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { YTDLP_STATUS_KEY } from '@openwav/shared';

const run = promisify(execFile);

const latestFromPypi = async () => {
  const res = await fetch('https://pypi.org/pypi/yt-dlp/json', { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`PyPI responded ${res.status}`);
  return (await res.json()).info.version;
};

// The image installs yt-dlp system-wide; a --user upgrade lands in ~/.local, which Python imports first
export function createYtdlpMaintenance({ redis, logger, bin = process.env.YTDLP_PATH || 'yt-dlp', exec = run, latest = latestFromPypi }) {
  let state = { version: null, latest: null, checkedAt: null, updating: false, lastUpdate: null };

  const save = () => redis.set(YTDLP_STATUS_KEY, JSON.stringify(state)).catch((err) => logger.warn({ err: err.message }, 'yt-dlp status not saved'));

  async function report() {
    const [version, newest] = await Promise.all([
      exec(bin, ['--version']).then(({ stdout }) => stdout.trim(), () => null),
      latest().catch(() => state.latest),
    ]);
    state = { ...state, version, latest: newest, checkedAt: new Date().toISOString() };
    await save();
    return state;
  }

  async function update() {
    if (state.updating) return state;
    state = { ...state, updating: true };
    await save();
    let lastUpdate;
    try {
      const { stdout } = await exec('pip3', ['install', '--user', '--upgrade', '--break-system-packages', '--no-cache-dir', 'yt-dlp[default]'], { timeout: 300_000 });
      lastUpdate = { at: new Date().toISOString(), ok: true, output: stdout.trim().split('\n').slice(-3).join('\n') };
    } catch (err) {
      lastUpdate = { at: new Date().toISOString(), ok: false, output: (err.stderr || err.message).toString().trim().slice(-500) };
      logger.warn({ err: lastUpdate.output }, 'yt-dlp update failed');
    }
    state = { ...state, updating: false, lastUpdate };
    return report();
  }

  return { report, update };
}
