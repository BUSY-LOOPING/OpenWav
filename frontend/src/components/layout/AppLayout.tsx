import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useSidebar } from '../../hooks/useSidebar';
import type { NavSection, Playlist } from '../../types';

const PUBLIC_NAV: NavSection[] = [
  {
    items: [
      { label: 'Home',    icon: 'home',    href: '/' },
      { label: 'Explore', icon: 'explore', href: '/explore' },
      { label: 'Library', icon: 'library', href: '/library' },
      { label: 'Upgrade', icon: 'upgrade', href: '/upgrade' },
    ],
  },
];

const MOCK_PLAYLISTS: Playlist[] = [
  { id: '1', name: 'Liked music',        owner: 'You',         isPinned: true, isAuto: true },
  { id: '2', name: 'Mood',               owner: 'Dhruv Yadav' },
  { id: '3', name: 'Episodes for later', owner: '',            isAuto: true },
  { id: '4', name: 'Gaming Mix',         owner: 'Dhruv Yadav' },
  { id: '5', name: 'Study Lofi',         owner: 'Dhruv Yadav' },
];

interface AppLayoutProps {
  children: ReactNode;
  playerBar?: ReactNode;
  activeHref?: string;
  playlistsLoading?: boolean;
  userName?: string;
}

export function AppLayout({
  children,
  playerBar,
  activeHref = '/',
  playlistsLoading = false,
  userName = 'User',
}: AppLayoutProps) {
  const { state, isMobile, toggle, close } = useSidebar();

  return (
    <div className="flex flex-col h-screen bg-[#030303] overflow-hidden">
      <Topbar onHamburgerClick={toggle} userName={userName} showSearch={true} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          state={state}
          isMobile={isMobile}
          onClose={close}
          navSections={PUBLIC_NAV}
          activeHref={activeHref}
          playlists={MOCK_PLAYLISTS}
          playlistsLoading={playlistsLoading}
          showPlaylists
          showNewPlaylist
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded">
          {children}
        </main>
      </div>

      {playerBar && (
        <div className="shrink-0 border-t border-white/[0.06]">{playerBar}</div>
      )}
    </div>
  );
}