"use client";

/** Small trend line for a card. Actual months are filled dots, forecast months are open. */
export default function Spark({
  values,
  actual,
  color = "var(--color-sea)",
}: {
  values: number[];
  actual: boolean[];
  color?: string;
}) {
  const W = 160;
  const H = 36;
  // Scale to the data itself so month-to-month changes are visible.
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => (values.length < 2 ? W / 2 : 4 + (i * (W - 8)) / (values.length - 1));
  const y = (v: number) => (max === min ? H / 2 : 4 + ((max - v) / span) * (H - 8));
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-40" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r="2.2"
          fill={actual[i] ? color : "var(--color-paper)"}
          stroke={color}
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}
