import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, type MenuItem } from './Menu';
import { SaveToPlaylistDialog } from './PlaylistDialogs';
import { toast } from '../lib/toast';
import { IconButton } from './ui';
import { useToggleLike } from '../lib/queries';
import type { Track } from '../lib/types';
import { addToQueue, playNext } from '../store/player';
import { useAppDispatch } from '../store';

export function TrackMenu({ track, onRemove, extra = [], className = '' }: { track: Track; onRemove?: () => void; extra?: MenuItem[]; className?: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const like = useToggleLike();
  const [saving, setSaving] = useState(false);

  const items: MenuItem[] = [
    ...extra,
    { label: 'Play next', icon: 'playlist_play', onSelect: () => (dispatch(playNext(track)), toast('Song will play next')) },
    { label: 'Add to queue', icon: 'queue_music', onSelect: () => (dispatch(addToQueue(track)), toast('Song added to queue')) },
    {
      label: track.liked ? 'Remove from liked songs' : 'Add to liked songs',
      icon: track.liked ? 'heart_minus' : 'favorite',
      onSelect: () => like.mutate({ id: track.id, liked: !track.liked }),
      divider: true,
    },
    { label: 'Save to playlist', icon: 'playlist_add', onSelect: () => setSaving(true) },
    ...(onRemove ? [{ label: 'Remove from playlist', icon: 'delete', onSelect: onRemove, danger: true }] : []),
    ...(track.artists[0] ? [{ label: 'Go to artist', icon: 'person', onSelect: () => navigate(`/artist/${track.artists[0].id}`), divider: true }] : []),
    ...(track.album ? [{ label: 'Go to album', icon: 'album', onSelect: () => navigate(`/album/${track.album!.id}`) }] : []),
    {
      label: 'Share',
      icon: 'share',
      divider: true,
      onSelect: () => {
        navigator.clipboard?.writeText(`${window.location.origin}/watch/${track.id}`).catch(() => undefined);
        toast('Link copied to clipboard');
      },
    },
  ];

  return (
    <>
      <Menu
        label={`Actions for ${track.title}`}
        items={items}
        trigger={(props) => <IconButton {...props} icon="more_vert" label="More actions" className={className} />}
      />
      {saving && <SaveToPlaylistDialog mediaId={track.id} onClose={() => setSaving(false)} />}
    </>
  );
}
