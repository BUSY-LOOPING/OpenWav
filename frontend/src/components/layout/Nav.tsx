import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NewPlaylistDialog } from '../PlaylistDialogs';
import { Icon } from '../ui';
import { useMyPlaylists } from '../../lib/queries';

const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/explore', label: 'Explore', icon: 'explore' },
  { to: '/library', label: 'Library', icon: 'library_music' },
];

export function SideNav({ expanded }: { expanded: boolean }) {
  const [creating, setCreating] = useState(false);
  const { data: playlists = [] } = useMyPlaylists();

  return (
    <nav aria-label="Main" className={`hidden shrink-0 flex-col overflow-hidden border-r border-white/5 bg-canvas md:flex ${expanded ? 'w-60' : 'w-[72px]'}`}>
      <ul className="flex flex-col gap-1 p-2">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center rounded-lg ${expanded ? 'gap-5 px-4 py-3' : 'flex-col gap-1 py-3 text-[10px]'} hover:bg-white/10 ${isActive ? 'bg-white/10' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} fill={isActive} />
                  <span className={expanded ? 'text-sm' : ''}>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      {expanded && (
        <>
          <div className="mx-4 my-2 border-t border-white/10" />
          <button type="button" onClick={() => setCreating(true)} className="mx-4 my-2 flex items-center justify-center gap-2 rounded-full bg-white/10 py-2 text-sm font-medium hover:bg-white/20">
            <Icon name="add" /> New playlist
          </button>
          <ul className="thin-scrollbar flex-1 overflow-y-auto px-2 pb-4" aria-label="Your playlists">
            <li>
              <NavLink to="/library?tab=songs" className="flex items-center gap-3 rounded-lg px-4 py-2 hover:bg-white/10">
                <span className="min-w-0">
                  <span className="block truncate text-sm">Liked music</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Icon name="push_pin" size={14} fill /> Auto playlist
                  </span>
                </span>
              </NavLink>
            </li>
            {playlists.map((p) => (
              <li key={p.id}>
                <NavLink to={`/playlist/${p.id}`} className={({ isActive }) => `block rounded-lg px-4 py-2 hover:bg-white/10 ${isActive ? 'bg-white/10' : ''}`}>
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.owner?.username}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </>
      )}
      {creating && <NewPlaylistDialog onClose={() => setCreating(false)} />}
    </nav>
  );
}

export function BottomNav() {
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface md:hidden">
      <ul className="flex">
        {NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-white' : 'text-muted'}`}>
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} fill={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
