import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../../components/layout/TopBar';
import { Icon } from '../../components/ui';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: 'monitoring', end: true },
  { to: '/admin/users', label: 'Users', icon: 'group' },
  { to: '/admin/downloads', label: 'Downloads', icon: 'download' },
  { to: '/admin/media', label: 'Media', icon: 'library_music' },
  { to: '/admin/discovery', label: 'Auto-discovery', icon: 'travel_explore' },
  { to: '/admin/settings', label: 'Settings', icon: 'tune' },
];

export default function AdminLayout() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="shrink-0 border-b border-white/10 bg-canvas md:w-60 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-4">
          <Logo />
          <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-red-300">Admin</span>
        </div>
        <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/10 ${isActive ? 'bg-white/10 text-white' : 'text-muted'}`}
            >
              <Icon name={link.icon} /> {link.label}
            </NavLink>
          ))}
          <NavLink to="/" className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/10 md:mt-6">
            <Icon name="arrow_back" /> Back to app
          </NavLink>
        </nav>
      </aside>
      <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
