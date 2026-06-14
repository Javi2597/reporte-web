import { scoreColor } from "@/lib/utils/scoring";

const COLORS = {
  good: "#22c55e",
  mid: "#f59e0b",
  bad: "#ef4444",
} as const;

/** Anillo circular SVG que muestra un score 0-100 con color semántico. */
export function ScoreRing({
  score,
  size = 160,
  stroke = 12,
  label,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const color = COLORS[scoreColor(score)];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2330"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="font-bold tabular-nums"
          style={{ color, fontSize: size * 0.28 }}
        >
          {score}
        </span>
        {label && (
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
