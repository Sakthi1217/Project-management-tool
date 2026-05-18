interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function ProgressBar({ value, size = 'md', showLabel = true }: ProgressBarProps) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const color = value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : value >= 25 ? 'bg-yellow-500' : 'bg-gray-400';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} bg-gray-200 rounded-full overflow-hidden`}>
        <div className={`${height} ${color} rounded-full transition-all duration-300`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      {showLabel && <span className="text-xs font-medium text-gray-600 w-10 text-right">{Math.round(value)}%</span>}
    </div>
  );
}
