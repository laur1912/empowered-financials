"use client";

import { useEffect, useState } from "react";

/** Number field that commits on blur or Enter, so typing doesn't recalc every keystroke. */
export function NumField({
  value,
  onCommit,
  placeholder,
  className = "",
  step,
  allowEmpty = false,
  ariaLabel,
  disabled,
  align = "right",
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  step?: number;
  allowEmpty?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  align?: "right" | "center";
}) {
  const show = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 100) / 100));
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]);

  function commit() {
    const t = text.trim().replace(/[$,]/g, "");
    if (t === "") {
      if (allowEmpty) onCommit(null);
      else setText(show(value));
      return;
    }
    const n = Number(t);
    if (Number.isFinite(n)) {
      if (n !== value) onCommit(n);
    } else setText(show(value));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      value={text}
      step={step}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setText(show(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`num rounded border border-rule bg-paper px-2 py-1 ${align === "center" ? "text-center" : "text-right"} disabled:bg-transparent disabled:border-transparent ${className}`}
    />
  );
}

export function Stepper({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) return <span className="num block text-center text-muted">{value || "–"}</span>;
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-6 w-6 rounded text-muted hover:bg-sea-wash hover:text-ink"
      >
        −
      </button>
      <span className={`num w-5 text-center font-semibold ${value ? "text-ink" : "text-muted"}`}>{value}</span>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => onChange(value + 1)}
        className="h-6 w-6 rounded text-muted hover:bg-sea-wash hover:text-ink"
      >
        +
      </button>
    </div>
  );
}
