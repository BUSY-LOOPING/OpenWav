import { useEffect, useRef, useState } from "react";
import { useUserPlaylists, useAddTrack } from "../../hooks/usePlaylistQueries";
import { NewPlaylistModal } from "./NewPlaylistModal";
import type { Playlist } from "../../types/playlist";

interface SaveToPlaylistModalProps {
  mediaId: string;
  onClose: () => void;
}

export function SaveToPlaylistModal({
  mediaId,
  onClose,
}: SaveToPlaylistModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [showNew, setShowNew] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const { data: playlists = [], isLoading } = useUserPlaylists();
  const { mutate: addTrack } = useAddTrack();

  console.log("playlists", playlists);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleAdd(playlistId: string) {
    if (savedIds.has(playlistId)) return;
    addTrack(
      { playlistId, mediaId },
      {
        onSuccess: () => setSavedIds((prev) => new Set(prev).add(playlistId)),
      },
    );
  }

  if (showNew) {
    return (
      <NewPlaylistModal
        onClose={() => {
          setShowNew(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-[#21212135]"
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      <div className="w-full max-w-sm flex flex-col overflow-hidden bg-[#212121] border-2 border-white/10 rounded-lg">
        <div className="flex items-center justify-between pl-6 pr-3 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-white">Save to playlist</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#4d4d4d] p-2 bg-white/0 rounded-full flex justify-center items-center"
            aria-label="Close"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 24 }}
            >
              close
            </span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        ) : (
          <>
            <p className="px-6 pb-2 text-sm font-semibold text-white">
              All playlists
            </p>
            <div className="overflow-y-auto" style={{ maxHeight: "40vh" }}>
              {playlists.map((pl: Playlist) => {
                const isSaved = savedIds.has(pl.id);
                return (
                  <button
                    key={pl.id}
                    className="flex items-center gap-4 w-full px-6 py-2 hover:bg-white/5 transition-colors text-left"
                    onClick={() => handleAdd(pl.id)}
                  >
                    {pl.coverImageUrl ? (
                      <img
                        src={pl.coverImageUrl}
                        alt={pl.name}
                        className="w-12 h-12 object-cover flex-shrink-0"
                        style={{ borderRadius: 4 }}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-white/10"
                        style={{ borderRadius: 4 }}
                      >
                        <span
                          className="material-symbols-outlined text-white/40"
                          style={{ fontSize: 22 }}
                        >
                          music_note
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {pl.name}
                      </p>
                      <p className="text-xs text-white/50 mt-0.5">
                        {pl.totalTracks}{" "}
                        {pl.totalTracks === 1 ? "track" : "tracks"}
                      </p>
                    </div>
                    {isSaved && (
                      <span
                        className="material-symbols-outlined text-white/60 flex-shrink-0"
                        style={{ fontSize: 20 }}
                      >
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div
          className="flex justify-end px-6 py-4"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)" }}
        >
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-black bg-white hover:opacity-90 transition-opacity"
            style={{ borderRadius: 999 }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 28 }}
            >
              add
            </span>
            New playlist
          </button>
        </div>
      </div>
    </div>
  );
}
