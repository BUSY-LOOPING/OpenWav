import type { NavItem, NavSection, Playlist } from "../../types";
import { SkeletonSidebarPlaylist } from "../skeleton";
import { NavLink as RouterNavLink } from "react-router-dom";

export interface SidebarProps {
  state: "expanded" | "collapsed" | "hidden";
  isMobile: boolean;
  onClose: () => void;
  navSections: NavSection[];
  playlists?: Playlist[];
  playlistsLoading?: boolean;
  showPlaylists?: boolean;
  showNewPlaylist?: boolean;
  footerItems?: NavItem[];
}

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const ExploreIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polygon
      points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

const LibraryIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
  </svg>
);

const UpgradeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const DownloadsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
  </svg>
);

const SystemIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" />
  </svg>
);

const BackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
  </svg>
);

export const iconMap: Record<
  string,
  ({ className }: { className?: string }) => JSX.Element
> = {
  home: HomeIcon,
  explore: ExploreIcon,
  library: LibraryIcon,
  upgrade: UpgradeIcon,
  users: UsersIcon,
  downloads: DownloadsIcon,
  settings: SettingsIcon,
  system: SystemIcon,
  back: BackIcon,
};

function SidebarNavItem({
  item,
  isCollapsed,
  isMobile,
}: {
  item: NavItem;
  isCollapsed: boolean;
  isMobile: boolean;
}) {
  const Icon = iconMap[item.icon] || HomeIcon;
  const showCollapsed = isCollapsed && !isMobile;

  return (
    <RouterNavLink
      to={item.href}
      end={item.end ?? item.href === '/'}
      title={showCollapsed ? item.label : undefined}
      className={({ isActive }) => `
        flex items-center gap-4 rounded-lg
        transition-colors duration-150
        group relative py-2.5 px-4
        ${
          isActive
            ? "bg-white/10 text-white"
            : "text-[#aaa] hover:text-white hover:bg-white/[0.06]"
        }
      `}
    >
      <Icon className="w-5 h-5 md:w-6 md:h-6 shrink-0" />

      <span
        className="text-sm md:text-base whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{
          opacity: showCollapsed ? 0 : 1,
          width: showCollapsed ? 0 : "auto",
          maxWidth: showCollapsed ? 0 : "200px",
        }}
      >
        {item.label}
      </span>

      {/* {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" />
      )} */}

      {showCollapsed && (
        <div
          className="
          absolute left-full ml-3 px-2 py-1 rounded
          bg-[#1a1a1a] border border-white/10
          text-white text-xs font-medium whitespace-nowrap
          opacity-0 group-hover:opacity-100
          pointer-events-none transition-opacity duration-150 z-50
        "
        >
          {item.label}
        </div>
      )}
    </RouterNavLink>
  );
}

export function Sidebar({
  state,
  isMobile,
  onClose,
  navSections,
  playlists = [],
  playlistsLoading = false,
  showPlaylists = false,
  showNewPlaylist = false,
  footerItems = [],
}: SidebarProps) {
  const isExpanded = state === "expanded";
  const isCollapsed = state === "collapsed";
  const isHidden = state === "hidden";
  const showCollapsed = isCollapsed && !isMobile;

  return (
    <>
      {isMobile && !isHidden && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        style={{
          width: isMobile ? "240px" : isExpanded ? "240px" : "72px",
          transform: isMobile
            ? isHidden
              ? "translateX(-100%)"
              : "translateX(0)"
            : "translateX(0)",
          transition:
            "width 300ms cubic-bezier(0.4,0,0.2,1), transform 300ms cubic-bezier(0.4,0,0.2,1)",
        }}
        className={`
          flex flex-col bg-[#030303] border-r border-white/[0.06]
          h-full overflow-hidden shrink-0
          ${isMobile ? "fixed left-0 top-0 bottom-0 z-50" : "relative"}
        `}
      >
        <div
          className="flex flex-col gap-0.5 px-2 shrink-0 pt-3 flex-1 overflow-y-auto min-h-0
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-white/10
          [&::-webkit-scrollbar-thumb]:rounded
        "
        >
          {navSections.map((section, si) => (
            <div key={si} className="mb-1">
              {section.label && !showCollapsed && (
                <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-[#555] mb-2">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isCollapsed={isCollapsed}
                  isMobile={isMobile}
                />
              ))}
            </div>
          ))}

          {showNewPlaylist && (
            <>
              <div className="my-2 border-t border-white/[0.06] mx-3 shrink-0" />
              <div
                className="px-3 shrink-0 overflow-hidden transition-all duration-300"
                style={{
                  opacity: showCollapsed ? 0 : 1,
                  maxHeight: showCollapsed ? 0 : "60px",
                  pointerEvents: showCollapsed ? "none" : "auto",
                }}
              >
                <button
                  className="
                  flex items-center gap-2.5 px-3 py-2
                  bg-white/[0.06] hover:bg-white/10
                  rounded-full text-sm font-medium text-white
                  transition-colors duration-150 whitespace-nowrap
                "
                >
                  <PlusIcon className="w-4 h-4 shrink-0" />
                  <span>New playlist</span>
                </button>
              </div>

              {showCollapsed && (
                <div className="flex justify-center px-2 shrink-0">
                  <button
                    title="New playlist"
                    className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}

          {showPlaylists && (
            <div
              className="transition-opacity duration-300 mt-1"
              style={{
                opacity: showCollapsed ? 0 : 1,
                pointerEvents: showCollapsed ? "none" : "auto",
              }}
            >
              {playlistsLoading ? (
                <SkeletonSidebarPlaylist />
              ) : (
                playlists.map((pl) => (
                  <a
                    key={pl.id}
                    href={`/playlist/${pl.id}`}
                    className="block px-5 py-2 rounded-md text-[#aaa] hover:text-white hover:bg-white/[0.04] transition-colors duration-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">
                        {pl.name}
                      </span>
                      {pl.isPinned && (
                        <PinIcon className="w-3 h-3 text-[#aaa] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#666] truncate mt-0.5">
                      {pl.isAuto ? "Auto playlist" : pl.owner}
                    </p>
                  </a>
                ))
              )}
            </div>
          )}
        </div>

        {footerItems.length > 0 && (
          <>
            <div className="border-t border-white/[0.06] mx-3 shrink-0" />
            <div className="flex flex-col gap-0.5 px-2 py-2 shrink-0">
              {footerItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isCollapsed={isCollapsed}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
