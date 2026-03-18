import { useState, useEffect } from 'react';
import { useGlobalSettings, useUpdateSetting, useUpdateConcurrentDownloads } from '../../hooks/useAdminQueries';

const TABS = ['General', 'Audio', 'Limits', 'Cookies'];

const inputCls = "bg-[#111] border border-white/[0.08] text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-white/20 w-full transition-colors placeholder-[#444]";
const selectCls = "bg-[#111] border border-white/[0.08] text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-white/20 transition-colors";

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8 py-5 border-b border-white/[0.05]">
      <div className="sm:w-56 shrink-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {hint && <p className="text-xs text-[#555] mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer w-fit">
      <div onClick={() => onChange(!value)}
        className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-red-600' : 'bg-white/10'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-5' : 'left-1'}`} />
      </div>
      <span className="text-sm text-[#888]">{value ? 'Enabled' : 'Disabled'}</span>
    </label>
  );
}

function SkeletonField() {
  return (
    <div className="py-5 border-b border-white/[0.05] flex gap-8">
      <div className="w-56 shrink-0 space-y-2">
        <div className="h-3 bg-white/[0.06] rounded animate-pulse w-3/4" />
        <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-1/2" />
      </div>
      <div className="h-9 bg-white/[0.06] rounded-lg animate-pulse w-48" />
    </div>
  );
}

const FORMAT_OPTIONS = ['mp3', 'm4a', 'opus', 'flac', 'wav'];
const QUALITY_OPTIONS = ['64k', '96k', '128k', '160k', '192k', '256k', '320k'];

export default function AdminYtdlpPage() {
  const [activeTab, setActiveTab] = useState('General');
  const [dirty, setDirty]         = useState<Record<string, any>>({});

  const { data: settings, isLoading, isError } = useGlobalSettings();
  const updateSetting = useUpdateSetting();
  const updateConcurrent = useUpdateConcurrentDownloads();

  function get(key: string, fallback: any = '') {
    if (key in dirty) return dirty[key];
    return settings?.[key]?.value ?? fallback;
  }

  function set(key: string, value: any) {
    setDirty(prev => ({ ...prev, [key]: value }));
  }

  function save() {
    Object.entries(dirty).forEach(([key, value]) => {
      if (key === 'concurrent_downloads') {
        updateConcurrent.mutate(Number(value));
      } else {
        updateSetting.mutate({ key, payload: { value } });
      }
    });
    setDirty({});
  }

  const isSaving = updateSetting.isPending || updateConcurrent.isPending;
  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-6 px-8 border-b border-white/[0.06] shrink-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-[#777] hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        {isError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-6 p-3 bg-red-400/5 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">error</span>
            Failed to load settings
          </div>
        )}

        {activeTab === 'General' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">General Settings</h2>
            <p className="text-sm text-[#555] mb-6">Core yt-dlp binary and process configuration.</p>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonField key={i} />)
              : <>
                  <FieldRow label="yt-dlp path" hint="Absolute path to yt-dlp binary">
                    <input className={inputCls} value={get('ytdlp_path', '/usr/local/bin/yt-dlp')} onChange={e => set('ytdlp_path', e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Concurrent downloads" hint="Max parallel download jobs">
                    <select className={selectCls} value={get('concurrent_downloads', '3')} onChange={e => set('concurrent_downloads', e.target.value)}>
                      {['1','2','3','4','5','8','10'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Temp directory" hint="Staging path before MinIO upload">
                    <input className={inputCls} value={get('temp_download_path', '/app/temp')} onChange={e => set('temp_download_path', e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Max retries" hint="Per-job retry attempts before dead-lettering">
                    <select className={selectCls} value={get('max_retries', '3')} onChange={e => set('max_retries', e.target.value)}>
                      {['1','2','3','5','10'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Auto-update yt-dlp" hint="Run yt-dlp --update on service start">
                    <Toggle value={get('ytdlp_auto_update', false)} onChange={v => set('ytdlp_auto_update', v)} />
                  </FieldRow>
                </>
            }
          </div>
        )}

        {activeTab === 'Audio' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Audio Settings</h2>
            <p className="text-sm text-[#555] mb-6">Default audio format and post-processing options.</p>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonField key={i} />)
              : <>
                  <FieldRow label="Default format" hint="Audio container when not specified by user">
                    <select className={selectCls} value={get('default_audio_format', 'mp3')} onChange={e => set('default_audio_format', e.target.value)}>
                      {FORMAT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Default quality" hint="Bitrate when not specified by user">
                    <select className={selectCls} value={get('default_audio_quality', '192k')} onChange={e => set('default_audio_quality', e.target.value)}>
                      {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Embed thumbnail" hint="Attach cover art to audio file">
                    <Toggle value={get('embed_thumbnail', true)} onChange={v => set('embed_thumbnail', v)} />
                  </FieldRow>
                  <FieldRow label="Embed metadata" hint="Write title, artist, album tags">
                    <Toggle value={get('embed_metadata', true)} onChange={v => set('embed_metadata', v)} />
                  </FieldRow>
                  <FieldRow label="Post-processor args" hint="Extra ffmpeg flags after extraction">
                    <input className={inputCls} value={get('postprocessor_args', '')} onChange={e => set('postprocessor_args', e.target.value)} placeholder="-acodec libmp3lame" />
                  </FieldRow>
                </>
            }
          </div>
        )}

        {activeTab === 'Limits' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Limits</h2>
            <p className="text-sm text-[#555] mb-6">Per-user and global download restrictions.</p>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonField key={i} />)
              : <>
                  <FieldRow label="Max file size (MB)" hint="Reject downloads exceeding this size">
                    <input type="number" className={inputCls} value={get('max_file_size_mb', 500)} onChange={e => set('max_file_size_mb', e.target.value)} placeholder="500" />
                  </FieldRow>
                  <FieldRow label="Rate limit (KB/s)" hint="Throttle yt-dlp download speed. Leave blank for unlimited">
                    <input type="number" className={inputCls} value={get('rate_limit_kbps', '')} onChange={e => set('rate_limit_kbps', e.target.value)} placeholder="Unlimited" />
                  </FieldRow>
                  <FieldRow label="Daily limit per user" hint="Max downloads per user per 24h">
                    <input type="number" className={inputCls} value={get('daily_download_limit', 20)} onChange={e => set('daily_download_limit', e.target.value)} placeholder="20" />
                  </FieldRow>
                  <FieldRow label="Allowed formats" hint="Formats users can request">
                    <div className="flex flex-wrap gap-2">
                      {FORMAT_OPTIONS.map(f => {
                        const current: string[] = get('allowed_formats', FORMAT_OPTIONS);
                        const active = Array.isArray(current) ? current.includes(f) : true;
                        return (
                          <button key={f} onClick={() => set('allowed_formats', active ? current.filter((x: string) => x !== f) : [...current, f])}
                            className={`px-3 py-1 rounded-lg text-sm font-mono border transition-colors ${active ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/[0.06] text-[#555] hover:border-white/10'}`}>
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </FieldRow>
                </>
            }
          </div>
        )}

        {activeTab === 'Cookies' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Cookies</h2>
            <p className="text-sm text-[#555] mb-6">Browser cookies for age-restricted or members-only content.</p>
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => <SkeletonField key={i} />)
              : <>
                  <FieldRow label="Cookie file path" hint="Netscape-format cookies.txt passed to yt-dlp">
                    <input className={inputCls} value={get('cookie_file_path', '/app/config/cookies.txt')} onChange={e => set('cookie_file_path', e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Cookie browser" hint="Extract cookies directly from an installed browser">
                    <select className={selectCls} value={get('cookie_browser', '')} onChange={e => set('cookie_browser', e.target.value)}>
                      <option value="">None (use file)</option>
                      <option value="chrome">Chrome</option>
                      <option value="firefox">Firefox</option>
                      <option value="edge">Edge</option>
                    </select>
                  </FieldRow>
                </>
            }
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <button onClick={save} disabled={!hasDirty || isSaving}
            className="px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 flex items-center gap-2">
            {isSaving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
            Save changes
          </button>
          {hasDirty && (
            <button onClick={() => setDirty({})}
              className="px-5 py-2.5 bg-white/[0.06] text-white text-sm font-medium rounded-lg hover:bg-white/10 transition-colors">
              Discard
            </button>
          )}
          {hasDirty && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">edit</span>
              Unsaved changes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}