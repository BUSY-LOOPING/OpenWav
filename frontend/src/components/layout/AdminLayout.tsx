import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useSidebar } from '../../hooks/useSidebar';
import type { NavSection } from '../../types';

const ADMIN_NAV: NavSection[] = [
  {
    label: 'Admin Dashboard',
    items: [
      { label: 'System Info', icon: 'system',    href: '/admin'  ,end:true},
      { label: 'Users',       icon: 'users',     href: '/admin/users' },
      { label: 'Downloads',   icon: 'downloads', href: '/admin/downloads'},
      { label: 'yt-dlp',     icon: 'settings',  href: '/admin/ytdlp' },
    ],
  },
];

const ADMIN_FOOTER_NAV = [
  { label: 'Back to App', icon: 'back', href: '/' },
];

interface AdminLayoutProps {
  children: ReactNode;
  activeHref?: string;
  userName?: string;
}

export function AdminLayout({ children, activeHref = '/admin', userName = 'User' }: AdminLayoutProps) {
  const { state, isMobile, toggle, close } = useSidebar();

  return (
    <div className="flex flex-col h-screen bg-[#030303] overflow-hidden">
      <Topbar onHamburgerClick={toggle} userName={userName} showSearch={false} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          state={state}
          isMobile={isMobile}
          onClose={close}
          navSections={ADMIN_NAV}
          footerItems={ADMIN_FOOTER_NAV}
          showPlaylists={false}
          showNewPlaylist={false}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded">
          {children}
        </main>
      </div>
    </div>
  );
}