import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CollectionHeader, PlayButtons } from '../components/CollectionHeader';
import { Dialog } from '../components/Dialog';
import { Menu } from '../components/Menu';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { toast } from '../lib/toast';
import { Button, Icon, IconButton, Status, Thumb, inputClass } from '../components/ui';
import { ytFallback } from '../components/youtubeResult';
import { errorMessage } from '../lib/api';
import { formatDuration, formatTime } from '../lib/format';
import { useTaskProgress } from '../lib/progress';
import { useOnlinePlaylist, usePlaylist, usePlaylistMutations } from '../lib/queries';
import type { PlaylistDetail, PlaylistImport, PlaylistTrack, YoutubeResult } from '../lib/types';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

function EditDialog({ playlist, onClose }: { playlist: PlaylistDetail; onClose: () => void }) {
  const { update } = usePlaylistMutations(playlist.id);
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [isPublic, setIsPublic] = useState(playlist.isPublic);
  async function save() {
    try {
      await update.mutateAsync({ name: name.trim(), description: description.trim() || null, isPublic });
      onClose();
    } catch (e) {
      toast(errorMessage(e));
    }
  }
  return (
    <Dialog
      title="Edit playlist"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Title
          <input className={inputClass} value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Description
          <textarea className={inputClass} rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="flex items-center justify-between text-sm">
          Public
          <input type="checkbox" role="switch" aria-label="Public playlist" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-5 w-9 accent-white" />
        </label>
      </div>
    </Dialog>
  );
}

type ImportTask = PlaylistImport['tasks'][number];

const videoIdOf = (raw: string) => {
  const url = new URL(raw);
  return url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
};

function PendingRow({ task, info }: { task: ImportTask; info?: YoutubeResult }) {
  const videoId = info?.videoId ?? videoIdOf(task.url);
  const title = info?.title ?? task.title ?? 'Loading…';
  const failed = task.status === 'failed' || task.status === 'cancelled';
  return (
    <div role="row" aria-busy={!failed} className="flex min-h-14 items-center gap-3 rounded-md px-2 py-1.5 opacity-50 sm:px-3">
      <Thumb src={info?.thumbnailUrl ?? null} fallback={videoId ? ytFallback(videoId) : null} alt="" className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-sm text-muted">
          {failed ? "Couldn't download" : (info?.artists?.join(', ') ?? info?.channel ?? (task.status === 'queued' ? 'Waiting to download' : 'Downloading'))}
          {info?.album && <span className="lg:hidden"> • {info.album}</span>}
        </p>
        {!failed && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-label={`Downloading ${title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progress}>
            <div className="h-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
          </div>
        )}
      </div>
      <span className="hidden w-1/4 truncate text-sm text-muted lg:block">{info?.album ?? ''}</span>
      <span className="hidden w-12 text-right text-sm text-muted tabular-nums sm:block">{info?.durationSec ? formatTime(info.durationSec) : ''}</span>
      <span className="w-10 shrink-0" />
    </div>
  );
}

function useImportTasks(job: PlaylistImport | null) {
  const tasks = job?.tasks ?? [];
  const live = useTaskProgress(tasks.map((t) => t.id));
  return tasks.map((t) => {
    const e = live[t.id];
    return e ? { ...t, status: e.status, progress: e.progress ?? t.progress, title: t.title ?? e.title } : t;
  });
}

function ImportBar({ job, tasks }: { job: PlaylistImport; tasks: ImportTask[] }) {
  const total = job.total || tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  return (
    <div className="mb-4 px-2 sm:px-3">
      <p className="text-sm text-muted">{total ? `Downloading ${done} of ${total}` : 'Fetching playlist…'}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full bg-accent transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function Playlist() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: playlist, isLoading, isError } = usePlaylist(id);
  const mutations = usePlaylistMutations(id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [order, setOrder] = useState<PlaylistTrack[]>([]);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => setOrder(playlist?.tracks ?? []), [playlist?.tracks]);
  const importTasks = useImportTasks(playlist?.import ?? null);
  const listId = playlist?.import ? new URL(playlist.import.url).searchParams.get('list') : null;
  const preview = useOnlinePlaylist(listId ?? '', !!listId);

  if (isLoading)
    return (
      <div className="mx-auto max-w-5xl px-4 pt-8">
        {Array.from({ length: 8 }, (_, i) => (
          <TrackRowSkeleton key={i} />
        ))}
      </div>
    );
  if (isError || !playlist) return <Status icon="playlist_remove" title="This playlist isn't available" message="It may be private or deleted." />;

  const owner = playlist.isOwner;
  // Tracks still downloading sit at their playlist position until they land in the track list
  const pending = importTasks.filter((t) => t.status !== 'completed' && t.position !== null);
  const rows = pending.length
    ? [...order.map((t, i) => ({ t, i, at: t.position })), ...pending.map((task) => ({ task, at: task.position ?? 0 }))].sort((a, b) => a.at - b.at)
    : order.map((t, i) => ({ t, i }));
  const canDrag = owner && !pending.length;
  const previewByVideo = new Map((preview.data?.tracks ?? []).map((t) => [t.videoId, t]));
  const play = (shuffle: boolean) => order.length && dispatch(playTracks({ tracks: order, shuffle }));

  function drop(to: number) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    mutations.reorder.mutate(next.map((t) => t.id), { onError: (e) => toast(errorMessage(e)) });
  }

  const ownerMenu = [
    { label: 'Edit playlist', icon: 'edit', onSelect: () => setEditing(true) },
    {
      label: playlist.isPublic ? 'Make private' : 'Make public',
      icon: playlist.isPublic ? 'lock' : 'public',
      onSelect: () => mutations.update.mutate({ isPublic: !playlist.isPublic }),
    },
    {
      label: 'Share',
      icon: 'share',
      onSelect: () => {
        navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
        toast('Link copied to clipboard');
      },
    },
    { label: 'Delete playlist', icon: 'delete', onSelect: () => setConfirmDelete(true), danger: true, divider: true },
  ];

  return (
    <div className="mx-auto flex max-w-[1478px] flex-col gap-4 px-4 sm:px-8 xl:flex-row xl:gap-12 xl:px-12">
      <div className="xl:w-[380px] xl:shrink-0">
        <CollectionHeader
          cover={playlist.coverUrls}
          title={playlist.name}
          description={playlist.description}
          meta={
            <>
              <p>
                Playlist • {playlist.isPublic ? 'Public' : 'Private'} • {new Date(playlist.createdAt).getFullYear()}
              </p>
              <p>
                {playlist.owner?.username} • {playlist.trackCount} tracks • {formatDuration(playlist.durationSec)}
              </p>
            </>
          }
          actions={
            <>
              {owner ? (
                <IconButton icon="edit" label="Edit playlist" onClick={() => setEditing(true)} className="h-10 w-10 bg-white/10" />
              ) : (
                  <IconButton
                    icon={playlist.saved ? 'library_add_check' : 'library_add'}
                    label={playlist.saved ? 'Remove from library' : 'Save to library'}
                    onClick={() => mutations.save.mutate(!playlist.saved)}
                    className="h-10 w-10 bg-white/10"
                  />
                )}
                <PlayButtons onPlay={() => play(false)} onShuffle={() => play(true)} disabled={!order.length} />
                {owner && <Menu label="Playlist actions" items={ownerMenu} trigger={(props) => <IconButton {...props} icon="more_vert" label="More playlist actions" className="h-10 w-10 bg-white/10" />} />}
              </>
            }
          />
        </div>
        <div className="min-w-0 flex-1 pb-6 xl:pt-6">
          {playlist.import && <ImportBar job={playlist.import} tasks={importTasks} />}
          {!order.length && !playlist.import && <Status icon="queue_music" title="No songs yet" message={owner ? 'Use "Save to playlist" on any song to add it here.' : undefined} />}
          <div role="table" aria-label="Tracks">
            {rows.map((row) =>
              'task' in row ? (
                <PendingRow key={row.task.id} task={row.task} info={previewByVideo.get(videoIdOf(row.task.url) ?? '')} />
              ) : (
              <TrackRow
                key={row.t.id}
                track={row.t}
                tracks={order}
                index={row.i}
                onRemove={owner ? () => mutations.removeTrack.mutate(row.t.id) : undefined}
                drag={
                  canDrag
                    ? {
                        onDragStart: () => (dragFrom.current = row.i),
                        onDragOver: (e) => e.preventDefault(),
                        onDrop: () => drop(row.i),
                      }
                    : undefined
                }
              />
            ),
          )}
        </div>
      </div>
      {editing && <EditDialog playlist={playlist} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <Dialog
          title="Delete playlist?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  mutations.remove.mutate(undefined, {
                    onSuccess: () => {
                      toast('Playlist deleted');
                      navigate('/library');
                    },
                    onError: (e) => toast(errorMessage(e)),
                  })
                }
              >
                <Icon name="delete" /> Delete
              </Button>
            </>
          }
        >
          <p className="pb-2 text-sm text-muted">"{playlist.name}" will be permanently deleted.</p>
        </Dialog>
      )}
    </div>
  );
}
