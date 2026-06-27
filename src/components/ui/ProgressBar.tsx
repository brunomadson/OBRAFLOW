import { cn } from "@/lib/utils";

interface Props {
  value: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  color = "#10B981",
  height = 6,
  showLabel = true,
  className,
}: Props) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-[11px] text-slate-500">Progresso</span>
          <span className="text-[11px] font-bold" style={{ color }}>{clamped}%</span>
        </div>
      )}
      <div className="bg-slate-100 rounded-full" style={{ height }}>
        <div
          className="rounded-full transition-all duration-500"
          style={{ background: color, height, width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
