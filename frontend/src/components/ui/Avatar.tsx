interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  return (
    <div
      className={`
        rounded-full bg-[#8B5CF6] flex items-center justify-center
        font-bold text-white shrink-0 select-none
        ${sizeMap[size]} ${className}
      `}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}