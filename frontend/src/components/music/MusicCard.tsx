import { useState, useRef, useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store";
import { playTrack } from "../../store/slices/playerSlice";
import type { Tile } from "../../services/mediaService";
import { CARD_HEIGHT } from "../skeleton";

import MoreIcon from "../../assets/svg/more_vert.svg?react";
import { SaveToPlaylistModal } from "./SaveToPlaylistModal";

interface MusicCardProps {
  tile: Tile;
  queue?: Tile[];
  width?: number;
  onShufflePlay?: (tile: Tile) => void;
  onStartMix?: (tile: Tile) => void;
  onPlayNext?: (tile: Tile) => void;
  onAddToQueue?: (tile: Tile) => void;
  onSaveToLibrary?: (tile: Tile) => void;
  onDownload?: (tile: Tile) => void;
  onSaveToPlaylist?: (tile: Tile) => void;
  onGoToArtist?: (tile: Tile) => void;
}

const MENU_ITEMS = [
  { key: "shuffle", icon: "shuffle", label: "Shuffle play" },
  { key: "mix", icon: "sensors", label: "Start mix" },
  { key: "divider" },
  { key: "playNext", icon: "skip_next", label: "Play next" },
  { key: "addToQueue", icon: "add_to_queue", label: "Add to queue" },
  { key: "divider" },
  { key: "saveToLibrary", icon: "bookmark", label: "Save to library" },
  { key: "download", icon: "download", label: "Download" },
  { key: "saveToPlaylist", icon: "playlist_add", label: "Save to playlist" },
  { key: "divider" },
  { key: "goToArtist", icon: "person", label: "Go to artist" },
] as const;

function MosaicThumbnail({ images }: { images: string[] }) {
  const filled = [...images, ...Array(4).fill("")].slice(0, 4);
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
      {filled.map((src, i) =>
        src ? (
          <img
            key={i}
            src={src}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div key={i} className="w-full h-full bg-[#1a1a1a]" />
        ),
      )}
    </div>
  );
}

function ContextMenu({
  anchorEl,
  onAction,
  onClose,
}: {
  anchorEl: HTMLButtonElement;
  onAction: (key: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    visibility: "hidden",
  });

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const menuHeight = ref.current?.offsetHeight ?? 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow > menuHeight
        ? rect.bottom + window.scrollY
        : rect.top + window.scrollY - menuHeight;

    setStyle({
      position: "fixed",
      top: spaceBelow > menuHeight ? rect.bottom : rect.top - menuHeight,
      left: rect.right - 208,
      visibility: "visible",
    });
  }, [anchorEl]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      )
        onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorEl]);

  return (
    <div
      ref={ref}
      className="z-[9999] w-52 overflow-y-auto bg-[#212121]"
      style={{
        ...style,
        border: "0.5px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {MENU_ITEMS.map((item, i) => {
        if (item.key === "divider") {
          return (
            <div
              key={i}
              className="my-1"
              style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)" }}
            />
          );
        }
        return (
          <button
            key={item.key}
            className="flex items-center gap-3 w-full px-3 py-3 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onAction(item.key);
              onClose();
            }}
          >
            <span
              className="material-symbols-outlined text-white/60"
              style={{ fontSize: "18px", lineHeight: 1 }}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function MusicCard({
  tile,
  queue = [],
  width,
  onShufflePlay,
  onStartMix,
  onPlayNext,
  onAddToQueue,
  onSaveToLibrary,
  onDownload,
  onSaveToPlaylist,
  onGoToArtist,
}: MusicCardProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [menuOpen, setMenuOpen] = useState(false);
  const isCircle = tile.tileType === "circle";
  const isMosaic = tile.tileType === "mosaic";
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [saveToPlaylistOpen, setSaveToPlaylistOpen] = useState(false);

  function handlePlay() {
    dispatch(
      playTrack({
        track: {
          id: tile.id,
          title: tile.title,
          subtitle: tile.subtitle,
          thumbnail: tile.thumbnail,
        },
        queue: queue.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.subtitle,
          thumbnail: t.thumbnail,
        })),
      }),
    );
  }

  function handleMenuAction(key: string) {
    const map: Record<string, (() => void) | undefined> = {
      shuffle: () => onShufflePlay?.(tile),
      mix: () => onStartMix?.(tile),
      playNext: () => onPlayNext?.(tile),
      addToQueue: () => onAddToQueue?.(tile),
      saveToLibrary: () => onSaveToLibrary?.(tile),
      download: () => onDownload?.(tile),
      saveToPlaylist: () => setSaveToPlaylistOpen(true),
      goToArtist: () => onGoToArtist?.(tile),
    };
    map[key]?.();
  }

  return (
    <div
      className="group cursor-pointer flex-shrink-0 flex flex-col"
      style={width ? { width } : undefined}
      onClick={handlePlay}
    >
      <div
        className={`relative w-full mb-3 overflow-visible ${isCircle ? "rounded-full" : "rounded-md"}`}
        style={{ height: CARD_HEIGHT }}
      >
        {/* thumbnail content */}
        <div
          className={`w-full h-full overflow-hidden ${isCircle ? "rounded-full" : "rounded-md"}`}
        >
          {isMosaic && tile.images?.length ? (
            <MosaicThumbnail images={tile.images} />
          ) : tile.thumbnail ? (
            <img
              src={tile.thumbnail}
              alt={tile.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#2a2a2a]">
              <svg
                viewBox="0 0 24 24"
                fill="rgba(255,255,255,0.15)"
                className="w-8 h-8"
              >
                <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h3V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        <button
          ref={menuButtonRef}
          className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-[#ffffff00]"
          style={{ border: "0.5px solid rgba(255,255,255,0.15)" }}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="More options"
        >
          <MoreIcon className="w-4 h-4" style={{ fill: "white" }} />
        </button>

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="black" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {!!tile.resumePosition && tile.resumePosition > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-md"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <div className="h-full bg-red-500" style={{ width: "40%" }} />
          </div>
        )}
      </div>

      {menuOpen && (
        <ContextMenu
          anchorEl={menuButtonRef.current}
          onAction={handleMenuAction}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {saveToPlaylistOpen && (
        <SaveToPlaylistModal
          mediaId={tile.id}
          onClose={() => setSaveToPlaylistOpen(false)}
        />
      )}

      <p className="text-sm font-semibold text-white truncate group-hover:underline leading-tight">
        {tile.title}
      </p>
      {tile.subtitle && (
        <p className="text-xs text-gray-500 truncate mt-0.5">{tile.subtitle}</p>
      )}
    </div>
  );
}
