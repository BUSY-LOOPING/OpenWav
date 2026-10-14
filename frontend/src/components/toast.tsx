import { useToasts } from '../lib/toast';

export function Toaster() {
  const items = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-36 z-[300] flex flex-col items-center gap-2 px-4 md:bottom-24">
      {items.map((t) => (
        <div key={t.id} className="rounded bg-[#f1f1f1] px-4 py-3 text-sm text-black shadow-lg">
          {t.message}
        </div>
      ))}
    </div>
  );
}
