import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn, formatDelta } from "@/lib/utils";

/** Tarjeta de métrica con valor, variación y sparkline opcional. */
export function StatCard({
  label,
  value,
  delta,
  hint,
  spark,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  spark?: number[];
  className?: string;
}) {
  const positive = (delta ?? 0) > 0;
  const neutral = delta === undefined || delta === 0;

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {!neutral ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatDelta(delta ?? 0)}
          </span>
        ) : (
          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>

      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}

      {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 28;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 h-7 w-full"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
