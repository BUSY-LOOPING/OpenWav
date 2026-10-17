import { useEffect, useState } from 'react';

interface PagedQuery<T> {
  data?: { pages: { data: T[] }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

export interface Pager {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function usePager<T>(query: PagedQuery<T>, resetKey: string) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [resetKey]);
  const pages = query.data?.pages ?? [];
  const current = Math.min(index, Math.max(pages.length - 1, 0));
  const pager: Pager = {
    page: current + 1,
    hasPrev: current > 0,
    hasNext: current < pages.length - 1 || query.hasNextPage,
    loading: query.isFetchingNextPage,
    onPrev: () => setIndex(current - 1),
    onNext: async () => {
      if (current === pages.length - 1) await query.fetchNextPage();
      setIndex(current + 1);
    },
  };
  return { items: pages[current]?.data ?? [], pager };
}
