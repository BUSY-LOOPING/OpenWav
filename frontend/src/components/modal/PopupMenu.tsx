import { useEffect, useRef } from 'react';

export interface PopupMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerAbove?: boolean;
}

interface PopupMenuProps {
  items: PopupMenuItem[];
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  align?: 'left' | 'right';
  width?: number;
}

export function PopupMenu({ items, onClose, anchorRef, align = 'right', width = 240 }: PopupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose, anchorRef]);

  const posStyle: React.CSSProperties =
    align === 'right'
      ? { right: 0, top: 'calc(100% + 8px)' }
      : { left: 0, top: 'calc(100% + 8px)' };

  return (
    <div
      ref={menuRef}
      className="absolute z-[100] overflow-hidden shadow-2xl"
      style={{
        width,
        ...posStyle,
        background: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <ul className="py-1.5">
        {items.map((item) => (
          <li key={item.id}>
            {item.dividerAbove && (
              <div className="my-1.5 mx-3" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
            )}
            <button
              onClick={() => { item.onClick(); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left
                ${item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-[#ccc] hover:text-white hover:bg-white/[0.06]'
                }`}
            >
              {item.icon && (
                <span className="shrink-0 w-5 h-5 flex items-center justify-center opacity-70">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}