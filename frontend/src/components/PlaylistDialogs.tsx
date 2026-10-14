import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from './Dialog';
import { toast } from '../lib/toast';
import { Button, Chips, Icon, Spinner, Thumb, inputClass } from './ui';
import { errorMessage } from '../lib/api';
import { useAddToPlaylist, useCreatePlaylist, useImportPlaylist, useMyPlaylists } from '../lib/queries';

export function NewPlaylistDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'import'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const create = useCreatePlaylist();
  const importer = useImportPlaylist();
  const pending = create.isPending || importer.isPending;

  async function submit() {
    try {
      if (mode === 'create') {
        const playlist = await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, isPublic });
        if (onCreated) onCreated(playlist.id);
        else navigate(`/playlist/${playlist.id}`);
      } else {
        const result = await importer.mutateAsync({ url: url.trim(), name: name.trim() || undefined, isPublic });
        toast('Import started. Tracks appear as they finish downloading.');
        navigate(`/playlist/${result.playlistId}`);
      }
      onClose();
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  const valid = mode === 'create' ? name.trim().length > 0 : /^https?:\/\//.test(url.trim());

  return (
    <Dialog
      title="New playlist"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? <Spinner className="h-4 w-4" /> : mode === 'create' ? 'Create' : 'Import'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) submit();
        }}
      >
        <Chips options={['create', 'import'] as const} value={mode} onChange={setMode} labels={{ create: 'Create new', import: 'Import from URL' }} />
        {mode === 'import' && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            YouTube or SoundCloud playlist URL
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://music.youtube.com/playlist?list=…" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Title
          <input className={inputClass} value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder={mode === 'import' ? 'Use source title' : 'Title'} />
        </label>
        {mode === 'create' && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Description
            <textarea className={inputClass} rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        )}
        <label className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Icon name={isPublic ? 'public' : 'lock'} /> {isPublic ? 'Public' : 'Private'}
          </span>
          <input type="checkbox" role="switch" aria-label="Public playlist" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-5 w-9 accent-white" />
        </label>
      </form>
    </Dialog>
  );
}

export function SaveToPlaylistDialog({ mediaId, onClose }: { mediaId: string; onClose: () => void }) {
  const { data: playlists, isLoading } = useMyPlaylists();
  const add = useAddToPlaylist();
  const [creating, setCreating] = useState(false);
  const owned = (playlists ?? []).filter((p) => p.isOwner);

  async function save(playlistId: string, name: string) {
    try {
      await add.mutateAsync({ playlistId, mediaId });
      toast(`Saved to ${name}`);
      onClose();
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  if (creating)
    return (
      <NewPlaylistDialog
        onClose={onClose}
        onCreated={(id) => {
          save(id, 'new playlist');
        }}
      />
    );

  return (
    <Dialog
      title="Save to playlist"
      onClose={onClose}
      footer={
        <Button onClick={() => setCreating(true)}>
          <Icon name="add" /> New playlist
        </Button>
      }
    >
      {isLoading ? (
        <Spinner className="mx-auto my-6" />
      ) : owned.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">You have no playlists yet.</p>
      ) : (
        <ul className="flex flex-col">
          {owned.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => save(p.id, p.name)} className="flex w-full items-center gap-4 rounded-lg px-2 py-2 text-left hover:bg-white/10">
                <Thumb src={p.coverUrls[0]} className="h-12 w-12" icon="queue_music" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-muted">
                    {p.isPublic ? 'Public' : 'Private'} · {p.trackCount} tracks
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
