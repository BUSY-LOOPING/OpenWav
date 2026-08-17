import { useParams } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import { playTrack } from "../../store/slices/playerSlice";
import { usePlaylist } from "../../hooks/usePlaylistQueries";
import { PlaylistCover } from "../../components/music/PlaylistCover";
import { Avatar } from "../../components/ui/Avatar";
import { SkeletonBox } from "../../components/skeleton";
import type { PlaylistTrack } from "../../types/playlist";

import PlayIcon from "../../assets/svg/play.svg?react";
import DownloadIcon from "../../assets/svg/download.svg?react";
import MoreIcon from "../../assets/svg/more_vert.svg?react";

import type { RootState } from "../../store";
import { TrackRow } from "../../components/music/TrackRow";
import { formatTime } from "../../utils/mediaConverter";

export default function PlaylistPage() {
  const currentTrack = useSelector((s: RootState) => s.player.currentTrack);
  const isPlaying = useSelector((s: RootState) => s.player.isPlaying);

  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { data: playlist, isLoading, isError } = usePlaylist(id);

  console.log(playlist);

  function handlePlayAll() {
    const tracks = playlist?.tracks ?? [];
    if (!tracks.length) return;
    dispatch(
      playTrack({
        track: {
          id: tracks[0].id,
          title: tracks[0].title,
          subtitle: tracks[0].uploaderUsername ?? "",
          thumbnail: tracks[0].thumbnailPath,
        },
        queue: tracks.map((t: any) => ({
          id: t.id,
          title: t.title,
          subtitle: t.uploaderUsername ?? "",
          thumbnail: t.thumbnailPath,
        })),
      }),
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-64 shrink-0 p-8 flex flex-col gap-4">
          <SkeletonBox className="w-full rounded-lg" style={{ height: 220 }} />
          <SkeletonBox className="h-6 w-3/4" />
          <SkeletonBox className="h-4 w-1/2" />
        </div>
        <div className="flex-1 p-6 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBox key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !playlist) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#aaa] text-sm">Playlist not found</p>
      </div>
    );
  }

  const tracks = playlist.tracks ?? [];

  return (
    <div className="flex h-full flex-col lg:flex-row lg:pl-16 pt-10">
      <div className="flex flex-col items-center p-8 gap-4 lg:top-0 lg:sticky lg:self-start">
        <PlaylistCover tracks={tracks} name={playlist.name} size={220} />
        <div className="mt-2 flex flex-col justify-center items-center gap-3">
          <span className="text-white text-xl font-bold leading-4">
            {playlist.name}
          </span>
          <Avatar name={playlist.ownerUsername} size="sm" />
          <div className="flex flex-col items-center justify-center leading-[1.20rem] text-sm">
            <div className="text-white/70">
              Playlist • {playlist.isPublic ? "Public" : "Private"} •{" "}
              {new Date(playlist.createdAt).getFullYear()}
            </div>
            <div className="text-white/70">
              {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
              {playlist.totalDuration
                ? ` • ${formatTime(playlist.totalDuration, true)}`
                : ""}
            </div>
          </div>
          {playlist.description && (
            <div className="text-white/70 text-sm">{playlist.description}</div>
          )}
          <div className="flex items-center gap-3 justify-center">
            <DownloadIcon className="bg-[#1d1d1d] rounded-full box-content p-2 fill-white" />
            <span className="bg-[#1d1d1d] rounded-full box-content p-2 fill-white text-white material-symbols-outlined">
              edit
            </span>
            <PlayIcon className="w-12 h-12 bg-white rounded-full box-content p-2" />
            <span className="bg-[#1d1d1d] rounded-full box-content p-2 fill-white text-white material-symbols-outlined">
              share
            </span>
            <MoreIcon className="bg-[#1d1d1d] rounded-full box-content p-2 fill-white" />
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-white italic text-sm flex items-center justify-center w-full">
          No tracks yet
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 mx-5">
          {tracks.map((item: PlaylistTrack, idx: number) => (
            <TrackRow
              key={idx}
              track={item}
              index={idx + 1}
              allTracks={tracks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
