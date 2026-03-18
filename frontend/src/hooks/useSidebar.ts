import { useState, useEffect } from 'react';

export type SidebarState = 'expanded' | 'collapsed' | 'hidden';

export function useSidebar() {
  const [state, setState] = useState<SidebarState>('expanded');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      setState(e.matches ? 'hidden' : 'expanded');
    };
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const toggle = () => {
    if (isMobile) {
      setState(s => s === 'hidden' ? 'expanded' : 'hidden');
    } else {
      setState(s => s === 'expanded' ? 'collapsed' : 'expanded');
    }
  };

  const close = () => setState(isMobile ? 'hidden' : 'collapsed');

  return { state, isMobile, toggle, close };
}