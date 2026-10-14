import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav, SideNav } from './Nav';
import { TopBar } from './TopBar';
import { Dialog } from '../Dialog';
import { track } from '../../lib/events';
import { useIsMobile, useMediaQuery } from '../../lib/useMediaQuery';
import { AudioEngine } from '../../player/AudioEngine';
import { NowPlaying } from '../../player/NowPlaying';
import { PlayerBar } from '../../player/PlayerBar';
import { setNowPlayingOpen } from '../../store/player';
import { selectCurrentTrack, useAppDispatch, useAppSelector } from '../../store';

const SHORTCUTS: [string, string][] = [
  ['Space / k', 'Play or pause'],
  ['j', 'Seek back 10 seconds'],
  ['l', 'Seek forward 10 seconds'],
  ['Shift + n', 'Next song'],
  ['Shift + p', 'Previous song'],
  ['m', 'Mute or unmute'],
  ['r', 'Cycle repeat mode'],
  ['/', 'Search'],
  ['?', 'Show keyboard shortcuts'],
];

export function AppShell() {
  const isMobile = useIsMobile();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [expanded, setExpanded] = useState(isWide);
  const [shortcuts, setShortcuts] = useState(false);
  const hasTrack = useAppSelector((s) => !!selectCurrentTrack(s));
  const location = useLocation();
  const showShortcuts = useCallback(() => setShortcuts(true), []);
  const dispatch = useAppDispatch();
  const nowPlayingOpen = useAppSelector((s) => s.player.nowPlayingOpen);
  const previousPath = useRef(location.pathname);
  const collapse = () => nowPlayingOpen && dispatch(setNowPlayingOpen(false));

  useEffect(() => {
    const from = previousPath.current;
    previousPath.current = location.pathname;
    if (from !== location.pathname && !from.startsWith('/watch/')) dispatch(setNowPlayingOpen(false));
  }, [location.pathname, dispatch]);

  useEffect(() => setExpanded(isWide), [isWide]);

  useEffect(() => {
    track({ type: 'page_view', path: location.pathname });
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const bottomPadding = isMobile ? (hasTrack ? 'pb-36' : 'pb-20') : hasTrack ? 'pb-24' : 'pb-6';

  return (
    <div className="flex h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[999] focus:bg-white focus:p-2 focus:text-black">
        Skip to content
      </a>
      <div onPointerDownCapture={collapse}>
        <TopBar onMenu={() => setExpanded((e) => !e)} onShortcuts={showShortcuts} />
      </div>
      <div className="flex min-h-0 flex-1">
        {!isMobile && (
          <div onPointerDownCapture={collapse} className="flex">
            <SideNav expanded={expanded} />
          </div>
        )}
        <div className="relative flex min-w-0 flex-1">
          <main id="main" className={`thin-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden ${bottomPadding}`}>
            <Outlet />
          </main>
          <NowPlaying />
        </div>
      </div>
      <PlayerBar />
      {isMobile && <BottomNav />}
      <AudioEngine onHelp={showShortcuts} />
      {shortcuts && (
        <Dialog title="Keyboard shortcuts" onClose={() => setShortcuts(false)}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 pb-4 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{keys}</kbd>
                </dt>
                <dd className="text-muted">{action}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
    </div>
  );
}
