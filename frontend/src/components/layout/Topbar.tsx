import { useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import type { RootState, AppDispatch } from "../../store";
import { logout } from "../../store/slices/authSlice";
import { Avatar } from "../ui/Avatar";
import { PopupMenu, type PopupMenuItem } from "../modal/PopupMenu";

interface TopbarProps {
  onHamburgerClick: () => void;
  userName?: string;
  showSearch?: boolean;
}

const HamburgerIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const menuIcons = {
  person: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ),
  keyboard: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  ),
};

export function Topbar({ onHamburgerClick, userName = "User", showSearch = true }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);
  const isAdmin = user?.role === 'admin';

  const menuItems: PopupMenuItem[] = [
    {
      id: 'profile',
      label: user?.email ?? userName,
      icon: menuIcons.person,
      onClick: () => navigate('/profile'),
    },
    ...(isAdmin ? [{
      id: 'dashboard',
      label: 'Admin dashboard',
      icon: menuIcons.dashboard,
      onClick: () => navigate('/admin'),
      dividerAbove: true,
    }] : []),
    {
      id: 'settings',
      label: 'Settings',
      icon: menuIcons.settings,
      onClick: () => navigate('/settings'),
      dividerAbove: true,
    },
    {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      icon: menuIcons.keyboard,
      onClick: () => {},
    },
    {
      id: 'logout',
      label: 'Sign out',
      icon: menuIcons.logout,
      onClick: () => dispatch(logout()),
      danger: true,
      dividerAbove: true,
    },
  ];

  return (
    <header className="flex items-center h-16 px-4 gap-3 shrink-0 bg-[#030303] border-b border-white/[0.06] z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onHamburgerClick}
          className="text-[#aaa] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]"
          aria-label="Toggle sidebar"
        >
          <HamburgerIcon />
        </button>

        <div className="flex items-center gap-2 cursor-pointer">
          <span className="rounded-full bg-[#dc2626] h-9 w-9 flex items-center justify-center border-white border-2">
            <span className="material-symbols-outlined text-white leading-none">play_arrow</span>
          </span>
          <span className="font-semibold text-xl text-white tracking-tighter font-sans hidden md:block">
            OpenWav
          </span>
        </div>
      </div>

      {showSearch ? (
        <div className="flex-1">
          <div className="relative group max-w-2xl ml-10">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 group-focus-within:text-white transition-colors">
              <SearchIcon />
            </div>
            <input
              type="text"
              className="block w-full p-2.5 pl-10 text-sm text-white bg-[#212121] rounded-lg border border-transparent focus:border-white focus:bg-black placeholder-gray-400 outline-none transition-all"
              placeholder="Search songs, albums, artists, podcasts"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="relative shrink-0">
        <button
          ref={avatarRef}
          className="flex items-center gap-3"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Account menu"
        >
          <Avatar name={userName} size="md" />
        </button>

        {menuOpen && (
          <PopupMenu
            items={menuItems}
            onClose={() => setMenuOpen(false)}
            anchorRef={avatarRef as React.RefObject<HTMLElement>}
            align="right"
            width={240}
          />
        )}
      </div>
    </header>
  );
}