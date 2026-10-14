import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui';

export interface MenuItem {
  label: string;
  icon: string;
  onSelect: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  label: string;
  trigger: (props: { onClick: (e: React.MouseEvent) => void; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
}

export function Menu({ items, label, trigger }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 240;
    const height = Math.min(items.length * 44 + 16, window.innerHeight - 16);
    const top = rect.bottom + height > window.innerHeight ? Math.max(8, rect.top - height) : rect.bottom;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setPosition({ top, left });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <>
      {trigger({
        ref: buttonRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="thin-scrollbar fixed z-[250] w-60 overflow-y-auto rounded-lg border border-white/10 bg-surface py-2 shadow-2xl"
            style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, maxHeight: 'calc(100vh - 16px)' }}
          >
            {items.map((item) => (
              <div key={item.label}>
                {item.divider && <div className="my-2 border-t border-white/10" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm hover:bg-white/10 focus:bg-white/10 focus:outline-none ${
                    item.danger ? 'text-red-400' : 'text-white'
                  }`}
                >
                  <Icon name={item.icon} className="text-white/80" />
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
