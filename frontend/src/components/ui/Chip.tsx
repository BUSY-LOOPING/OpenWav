interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ label, active = false, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-all duration-200
        ${active
          ? 'bg-white text-black border-white'
          : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
        }
      `}
    >
      {label}
    </button>
  );
}