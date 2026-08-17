import { useState, useEffect, useRef } from "react";
import { useCreatePlaylist } from "../../hooks/usePlaylistQueries";
import api from "../../services/api";

interface NewPlaylistModalProps {
  onClose: () => void;
}

type Tab = "create" | "import";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200"
      style={{ background: checked ? "#fff" : "rgba(255,255,255,0.2)" }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-[#212121] shadow transition-transform duration-200 mt-1"
        style={{ transform: checked ? "translateX(26px)" : "translateX(4px)" }}
      />
    </button>
  );
}

function FieldLine({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
      <label className="text-xs text-[#aaa]">{label}</label>
      {children}
    </div>
  );
}

export function NewPlaylistModal({ onClose }: NewPlaylistModalProps) {
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [description, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [collaborate, setCollab] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytName, setYtName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const { mutate: createPlaylist, isPending } = useCreatePlaylist();
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleCreate() {
    if (!name.trim()) return;
    createPlaylist(
      { name: name.trim(), description, isPublic, collaborate },
      {
        onSuccess: onClose,
      },
    );
  }

  async function handleImport() {
    if (!ytUrl.trim()) return;
    setImporting(true);
    try {
      await api.post(
        "/playlists/import/youtube",
        JSON.stringify({ url: ytUrl, name: ytName || undefined, isPublic }),
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );
      setImportDone(true);
      setTimeout(onClose, 1500);
    } catch {
      setImporting(false);
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      <div className="w-full max-w-md border-1 border-white/20 flex flex-col overflow-hidden shadow-2xl bg-[#212121]">
        {/* header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-white mb-4">New playlist</h2>

          <div className="flex gap-0 rounded-lg overflow-hidden border border-white/10 text-sm">
            {(["create", "import"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 font-medium transition-colors"
                style={{
                  background:
                    tab === t ? "rgba(255,255,255,0.1)" : "transparent",
                  color: tab === t ? "#fff" : "#888",
                }}
              >
                {t === "create" ? "Create new" : "Import from YouTube"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-2 flex flex-col gap-5">
          {tab === "create" ? (
            <>
              <FieldLine label="Title">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Playlist title"
                  className="bg-transparent text-white text-sm outline-none placeholder-[#555] py-1"
                />
              </FieldLine>

              <FieldLine label="Description">
                <input
                  value={description}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Optional description"
                  className="bg-transparent text-white text-sm outline-none placeholder-[#555] py-1"
                />
              </FieldLine>

              <FieldLine label="Privacy">
                <button
                  type="button"
                  onClick={() => setIsPublic((p) => !p)}
                  className="flex items-center gap-2 text-white text-sm py-1 w-fit"
                >
                  <span className="text-[#aaa] text-lg">
                    {isPublic ? "🌐" : "🔒"}
                  </span>
                  <span className="font-medium">
                    {isPublic ? "Public" : "Private"}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4 text-[#aaa]"
                  >
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
              </FieldLine>

              <div className="flex items-center justify-between py-2">
                <span className="text-white text-sm font-medium">
                  Collaborate
                </span>
                <Toggle checked={collaborate} onChange={setCollab} />
              </div>
            </>
          ) : (
            <>
              <FieldLine label="YouTube playlist URL">
                <input
                  autoFocus
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  placeholder="https://youtube.com/playlist?list=..."
                  className="bg-transparent text-white text-sm outline-none placeholder-[#555] py-1"
                />
              </FieldLine>

              <FieldLine label="Playlist name (optional)">
                <input
                  value={ytName}
                  onChange={(e) => setYtName(e.target.value)}
                  placeholder="Leave blank to use YouTube title"
                  className="bg-transparent text-white text-sm outline-none placeholder-[#555] py-1"
                />
              </FieldLine>

              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-white text-sm font-medium">
                  Public playlist
                </span>
                <Toggle checked={isPublic} onChange={setIsPublic} />
              </div>

              {importDone && (
                <p className="text-sm text-green-400 text-center py-1">
                  Import queued — tracks will appear shortly
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-5">
          <button
            onClick={onClose}
            className="text-sm font-medium text-white opacity-60 hover:opacity-100 transition-opacity px-4 py-2"
          >
            Cancel
          </button>
          {tab === "create" ? (
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isPending}
              className="px-6 py-2 rounded-full text-sm font-semibold text-black bg-white transition-opacity disabled:opacity-40"
            >
              {isPending ? "Creating..." : "Create"}
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={!ytUrl.trim() || importing || importDone}
              className="px-6 py-2 rounded-full text-sm font-semibold text-black bg-white transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              {importing && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              )}
              {importing ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
