import { getInitials } from '../../utils/format';

interface AvatarProps {
  nombre: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ nombre, color = '#2563eb', size = 'md' }: AvatarProps) {
  const sizeClass = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size];

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      {getInitials(nombre)}
    </div>
  );
}
