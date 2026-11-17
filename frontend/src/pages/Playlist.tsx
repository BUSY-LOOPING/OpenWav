import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CollectionHeader, CollectionLayout, PlayButtons } from '../components/CollectionHeader';
import { Dialog } from '../components/Dialog';
import { Menu } from '../components/Menu';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { YoutubeRow } from '../components/YoutubeRow';
import { toast } from '../lib/toast';
import { Button, Icon, IconButton, LoadMore, Status, inputClass } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatDuration } from '../lib/format';
import { flat, loadPlaylistTracks, usePlayCollection, usePlaylist, usePlaylistItems, usePlaylistMutations } from '../lib/queries';
import type { PendingTrack, PlaylistDetail, PlaylistImport, PlaylistTrack, Task, YoutubeResult } from '../lib/types';
import { hydrated, videoIdOf } from '../store/downloads';
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

const REASON: Record<string, string> = { daily_limit: 'Daily download limit reached', storage_limit: 'Storage limit reached' };

const asResult = (p: PendingTrack): YoutubeResult => ({
  type: 'song',
  videoId: videoIdOf(p.url) ?? p.id,
  url: p.url,
  title: p.title ?? 'Loading…',
  channel: '',
  thumbnailUrl: null,
  durationSec: null,
  downloaded: false,
  mediaId: null,
});

function ImportBar({ job }: { job: PlaylistImport }) {
  return (
    <div className="mb-4 px-2 sm:px-3">
      <p className="text-sm text-muted">{job.total ? `Downloading ${job.done} of ${job.total}` : 'Fetching playlist…'}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={job.total} aria-valuenow={job.done}>
        <div className="h-full bg-accent transition-[width]" style={{ width: `${job.total ? (job.done / job.total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function Playlist() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: playlist, isLoading, isError } = usePlaylist(id);
  const items = usePlaylistItems(id, !!playlist?.import?.running);
  const mutations = usePlaylistMutations(id);
  const play = usePlayCollection();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dragged = useRef<PlaylistTrack | null>(null);
  const rows = flat(items);
  const tracks = rows.flatMap((r) => (r.track ? [r.track] : []));

  // Entries queued after page load have no live event yet; seed them so rows show their state
  const pages = items.data;
  useEffect(() => {
    const pending = (pages?.pages ?? []).flatMap((p) => p.data).flatMap((r) => (r.pending && r.pending.status !== 'failed' && r.pending.status !== 'cancelled' ? [{ ...r.pending, mediaId: null, errorMessage: null } as unknown as Task] : []));
    if (pending.length) dispatch(hydrated(pending));
  }, [pages, dispatch]);

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
  const playAll = (shuffle: boolean) => play(loadPlaylistTracks(id), shuffle);

  function drop(target: PlaylistTrack) {
    const from = dragged.current;
    dragged.current = null;
    if (!from || from.id === target.id) return;
    mutations.move.mutate({ mediaId: from.id, position: target.position }, { onError: (e) => toast(errorMessage(e)) });
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
    <CollectionLayout
      header={
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
              <PlayButtons onPlay={() => playAll(false)} onShuffle={() => playAll(true)} disabled={!playlist.trackCount} />
              {owner && <Menu label="Playlist actions" items={ownerMenu} trigger={(props) => <IconButton {...props} icon="more_vert" label="More playlist actions" className="h-10 w-10 bg-white/10" />} />}
            </>
          }
        />
      }
    >
      {playlist.import?.running && <ImportBar job={playlist.import} />}
      {items.isLoading && Array.from({ length: 8 }, (_, i) => <TrackRowSkeleton key={i} />)}
      {!items.isLoading && !rows.length && !playlist.import && <Status icon="queue_music" title="No songs yet" message={owner ? 'Use "Save to playlist" on any song to add it here.' : undefined} />}
      <div role="table" aria-label="Tracks">
        {rows.map((row) =>
          row.pending ? (
            <YoutubeRow key={row.id} result={asResult(row.pending)} error={row.pending.status === 'failed' || row.pending.status === 'cancelled' ? (REASON[row.pending.reason ?? ''] ?? "Couldn't download") : null} />
          ) : (
            <TrackRow
              key={row.id}
              track={row.track}
              tracks={tracks}
              index={tracks.indexOf(row.track)}
              onRemove={owner ? () => mutations.removeTrack.mutate(row.track.id) : undefined}
              drag={
                owner
                  ? {
                      onDragStart: () => (dragged.current = row.track),
                      onDragOver: (e) => e.preventDefault(),
                      onDrop: () => drop(row.track),
                    }
                  : undefined
              }
            />
          ),
        )}
        <LoadMore query={items} />
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
    </CollectionLayout>
  );
}
