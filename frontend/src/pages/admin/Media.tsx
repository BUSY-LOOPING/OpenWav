import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { toast } from '../../lib/toast';
import { Button, Thumb, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { artistNames, formatTime } from '../../lib/format';
import { useAdminAction, useAdminMedia } from '../../lib/queries';
import type { Track } from '../../lib/types';
import { DataList } from './DataList';
import { usePager } from './usePager';

function EditDialog({ track, onClose }: { track: Track; onClose: () => void }) {
  const action = useAdminAction('media');
  const [title, setTitle] = useState(track.title);
  const [artists, setArtists] = useState(artistNames(track));
  const save = () =>
    action.mutate(
      {
        method: 'patch',
        url: `/admin/media/${track.id}`,
        body: { title: title.trim(), artistNames: artists.split(',').map((a) => a.trim()).filter(Boolean) },
      },
      {
        onSuccess: () => {
          toast('Track updated');
          onClose();
        },
        onError: (e) => toast(errorMessage(e)),
      },
    );
  return (
    <Dialog
      title="Edit track"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim() || action.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Title
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Artists (comma separated)
          <input className={inputClass} value={artists} onChange={(e) => setArtists(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}

export default function Media() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [editing, setEditing] = useState<Track | null>(null);
  const [deleting, setDeleting] = useState<Track | null>(null);
  const action = useAdminAction('media');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useAdminMedia({ search: debounced || undefined });
  const { items, pager } = usePager(query, debounced);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Media</h1>
      <input className={`${inputClass} mb-6 sm:max-w-sm`} type="search" placeholder="Search title or artist" aria-label="Search media" value={search} onChange={(e) => setSearch(e.target.value)} />
      <DataList
        items={items}
        loading={query.isLoading}
        empty="No tracks"
        pager={pager}
        columns={[
          {
            header: 'Track',
            cell: (t) => (
              <div className="flex min-w-0 items-center gap-3">
                <Thumb src={t.thumbnailUrl} className="h-10 w-10 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted">{artistNames(t)}</p>
                </div>
              </div>
            ),
          },
          { header: 'Duration', cell: (t) => formatTime(t.durationSec) },
          { header: 'Plays', cell: (t) => t.playCount },
          {
            header: 'Actions',
            cell: (t) => (
              <div className="flex gap-2">
                <Button variant="secondary" className="px-3 py-1" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                <Button variant="danger" className="px-3 py-1" onClick={() => setDeleting(t)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />
      {editing && <EditDialog track={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Dialog
          title="Delete track?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  action.mutate(
                    { method: 'delete', url: `/admin/media/${deleting.id}` },
                    { onSuccess: () => toast('Track deleted'), onError: (e) => toast(errorMessage(e)) },
                  );
                  setDeleting(null);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="pb-2 text-sm text-muted">"{deleting.title}" and its audio file will be permanently removed from every playlist and library.</p>
        </Dialog>
      )}
    </div>
  );
}
