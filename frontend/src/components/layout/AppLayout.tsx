import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useSidebar } from '../../hooks/useSidebar';
import { useUserPlaylists } from '../../hooks/usePlaylistQueries';
import { NewPlaylistModal } from '../music/NewPlaylistModal';
import type { NavSection, Playlist } from '../../types';

const PUBLIC_NAV: NavSection[] = [
  {
    items: [
      { label: 'Home',    icon: 'home',    href: '/',        end: true },
      { label: 'Explore', icon: 'explore', href: '/explore' },
      { label: 'Library', icon: 'library', href: '/library' },
    ],
  },
];

interface AppLayoutProps {
  children: ReactNode;
  playerBar?: ReactNode;
  userName?: string;
}

export function AppLayout({ children, playerBar, userName = 'User' }: AppLayoutProps) {
  const { state, isMobile, toggle, close } = useSidebar();
  const [showModal, setShowModal] = useState(false);
  const { data: playlists, isLoading: playlistsLoading } = useUserPlaylists();

  const sidebarPlaylists: Playlist[] = (playlists ?? []);

  return (
    <div className="flex flex-col h-screen bg-[#030303] overflow-hidden">
      <Topbar onHamburgerClick={toggle} userName={userName} showSearch={true} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          state={state}
          isMobile={isMobile}
          onClose={close}
          navSections={PUBLIC_NAV}
          playlists={sidebarPlaylists}
          playlistsLoading={playlistsLoading}
          showPlaylists
          showNewPlaylist
          onNewPlaylist={() => setShowModal(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded">
          {children}
        </main>
      </div>

      {playerBar && (
        <div className="shrink-0">{playerBar}</div>
      )}

      {showModal && <NewPlaylistModal onClose={() => setShowModal(false)} />}
    </div>
  );
}