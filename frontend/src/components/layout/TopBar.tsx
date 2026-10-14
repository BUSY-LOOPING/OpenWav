import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu } from '../Menu';
import { Icon, IconButton } from '../ui';
import { useSuggestions } from '../../lib/queries';
import { logout } from '../../store/auth';
import { useAppDispatch, useAppSelector } from '../../store';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1" aria-label="OpenWav home">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white">
          <Icon name="play_arrow" fill size={12} />
        </span>
      </span>
      <span className="text-xl font-bold tracking-tighter">OpenWav</span>
    </Link>
  );
}

export function SearchBox({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: suggestions = [] } = useSuggestions(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  function go(q: string) {
    if (!q.trim()) return;
    setValue(q);
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    onDone?.();
  }

  const shown = open && value.trim().length > 1 ? suggestions.slice(0, 8) : [];

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        go(active >= 0 ? shown[active] : value);
      }}
    >
      <div className="flex items-center rounded-lg bg-white/10 transition-colors focus-within:bg-black">
        <Icon name="search" className="ml-3 text-muted" />
        <input
          id="global-search"
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, shown.length - 1));
            if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, -1));
            if (e.key === 'Escape') {
              setOpen(false);
              onDone?.();
            }
          }}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-label="Search songs, albums, artists"
          placeholder="Search songs, albums, artists, podcasts"
          className="h-10 w-full bg-transparent px-3 text-sm outline-none focus-visible:outline-none placeholder:text-muted"
        />
        {value && <IconButton icon="close" label="Clear search" onClick={() => setValue('')} className="mr-1 text-muted" />}
      </div>
      {shown.length > 0 && (
        <ul id="search-suggestions" role="listbox" className="absolute inset-x-0 top-11 z-50 rounded-lg bg-surface py-2 shadow-2xl">
          {shown.map((s, i) => (
            <li key={s} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(s)} className={`flex w-full items-center gap-4 px-4 py-2 text-left text-sm hover:bg-white/10 ${i === active ? 'bg-white/10' : ''}`}>
                <Icon name="search" className="text-muted" />
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function TopBar({ onMenu, onShortcuts }: { onMenu: () => void; onShortcuts: () => void }) {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [mobileSearch, setMobileSearch] = useState(false);

  if (mobileSearch)
    return (
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 bg-canvas px-2">
        <IconButton icon="arrow_back" label="Close search" onClick={() => setMobileSearch(false)} />
        <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
      </header>
    );

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-white/5 bg-canvas/95 px-2 backdrop-blur sm:px-4">
      <IconButton icon="menu" label="Guide" onClick={onMenu} className="hidden md:inline-flex" />
      <Logo />
      <div className="mx-auto hidden w-full max-w-xl px-4 md:block">
        <SearchBox />
      </div>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <IconButton icon="search" label="Search" onClick={() => setMobileSearch(true)} className="md:hidden" />
        {user && (
          <Menu
            label="Account"
            items={[
              ...(user.role === 'admin' ? [{ label: 'Admin dashboard', icon: 'admin_panel_settings', onSelect: () => navigate('/admin') }] : []),
              { label: 'Library', icon: 'library_music', onSelect: () => navigate('/library') },
              { label: 'Settings', icon: 'settings', onSelect: () => navigate('/settings') },
              { label: 'Keyboard shortcuts', icon: 'keyboard', onSelect: onShortcuts },
              { label: 'Sign out', icon: 'logout', onSelect: () => dispatch(logout()), divider: true },
            ]}
            trigger={(props) => (
              <button {...props} type="button" aria-label="Account menu" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-medium">
                {user.username.charAt(0).toUpperCase()}
              </button>
            )}
          />
        )}
      </div>
    </header>
  );
}
