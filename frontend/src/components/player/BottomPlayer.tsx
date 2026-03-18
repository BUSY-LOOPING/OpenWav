import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import {
  togglePlay,
  playNext,
  playPrev,
  setVolume,
  toggleShuffle,
  cycleRepeat,
  seek,
} from "../../store/slices/playerSlice";

import PlayIcon from "../../assets/svg/play.svg?react";
import PauseIcon from "../../assets/svg/pause.svg?react";
import SkipPrevIcon from "../../assets/svg/skip_prev.svg?react";
import SkipNextIcon from "../../assets/svg/skip_next.svg?react";
import VolumeIcon from "../../assets/svg/volume_up.svg?react";
import RepeatIcon from "../../assets/svg/repeat.svg?react";
import ShuffleIcon from "../../assets/svg/shuffle.svg?react";
import ThumbUpIcon from "../../assets/svg/thumb_up.svg?react";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function IconBtn({
  children,
  onClick,
  active = false,
  dimmed = false,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dimmed?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex items-center justify-center shrink-0 transition-opacity duration-150
        ${active ? "opacity-100" : dimmed ? "opacity-50 hover:opacity-100" : "opacity-75 hover:opacity-100"}`}
    >
      {children}
    </button>
  );
}

export default function BottomPlayer() {
  const dispatch = useDispatch<AppDispatch>();

  const currentTrack = useSelector((s: RootState) => s.player.currentTrack);
  const isPlaying = useSelector((s: RootState) => s.player.isPlaying);
  const progress = useSelector((s: RootState) => s.player.progress);
  const duration = useSelector((s: RootState) => s.player.duration);
  const volume = useSelector((s: RootState) => s.player.volume);
  const isShuffled = useSelector((s: RootState) => s.player.isShuffled);
  const repeatMode = useSelector((s: RootState) => s.player.repeatMode);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  if (!currentTrack) return null;

  const iconClass = "fill-white";
  const activeIconClass = "fill-red-500";

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col select-none"
      style={{ background: "#212121", borderTop: "1px solid #3d3d3d" }}
    >
      <div
        className="w-full cursor-pointer relative"
        style={{ height: 3, background: "rgba(255,255,255,0.2)" }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          dispatch(
            seek(
              Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) *
                duration,
            ),
          );
        }}
      >
        <div
          className="absolute left-0 top-0 h-full bg-red-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between h-[68px] px-4 sm:px-6 gap-3">
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn onClick={() => dispatch(playPrev())} dimmed label="Previous">
            <SkipPrevIcon className={`w-7 h-7 md:w-10 md:h-10 ${iconClass}`} />
          </IconBtn>

          <IconBtn
            onClick={() => dispatch(togglePlay())}
            label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <PauseIcon className={`w-10 h-10 md:w-14 md:h-14 ${iconClass}`} />
            ) : (
              <PlayIcon className={`w-10 h-10 md:w-14 md:h-15 ${iconClass}`} />
            )}
          </IconBtn>

          <IconBtn onClick={() => dispatch(playNext())} dimmed label="Next">
            <SkipNextIcon className={`w-7 h-7 md:w-10 md:h-10 ${iconClass}`} />
          </IconBtn>

          <span className="hidden sm:block tabular-nums text-[#aaa] text-sm whitespace-nowrap">
            {formatTime(progress)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3 min-w-0 flex-1 justify-center">
          {currentTrack.thumbnail ? (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-11 h-11 rounded object-cover shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded shrink-0 bg-[#3d3d3d]" />
          )}

          <div className="min-w-0 text-left">
            <p className="max-w-[50vw] sm:max-w-xs text-sm md:text-base font-semibold text-white truncate leading-tight">
              {currentTrack.title}
            </p>
            <p className="max-w-[50vw] sm:max-w-xs text-xs md:text-sm text-[#aaa] truncate mt-0.5">
              {currentTrack.subtitle ?? ""}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <IconBtn dimmed label="Like">
              <ThumbUpIcon className={`w-6 h-6 ${iconClass}`} />
            </IconBtn>
            <button
              aria-label="More options"
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 group/vol">
            <button
              aria-label="Volume"
              className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
            >
              <VolumeIcon className={`w-6 h-6 ${iconClass}`} />
            </button>
            <div
              className="relative h-1 rounded-full overflow-hidden cursor-pointer shrink-0"
              style={{
                width: 0,
                background: "rgba(255,255,255,0.2)",
                transition: "width 200ms ease",
              }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                dispatch(
                  setVolume(
                    Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                  ),
                );
              }}
            >
              <div
                className="absolute left-0 top-0 h-full bg-white rounded-full"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>

          <IconBtn
            onClick={() => dispatch(cycleRepeat())}
            active={repeatMode !== "off"}
            dimmed
            label="Repeat"
          >
            <RepeatIcon
              className={`w-6 h-6 ${repeatMode !== "off" ? activeIconClass : iconClass}`}
            />
          </IconBtn>

          <IconBtn
            onClick={() => dispatch(toggleShuffle())}
            active={isShuffled}
            dimmed
            label="Shuffle"
          >
            <ShuffleIcon
              className={`w-6 h-6 ${isShuffled ? activeIconClass : iconClass}`}
            />
          </IconBtn>

          <button
            aria-label="Expand"
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
            </svg>
          </button>
        </div>

        {/* mobile more */}
        <div className="flex sm:hidden items-center shrink-0 ml-2">
          <button
            aria-label="More"
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
