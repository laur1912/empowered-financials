"use client";

import { useEffect, useRef } from "react";

/** Full-page panel that opens over the planner. Esc or the close button closes it. */
export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  aside,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:p-4" role="presentation">
      <div className="sheet-backdrop absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[20px] bg-fog shadow-2xl outline-none sm:max-h-none sm:rounded-[20px]"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule bg-paper px-5 py-4 sm:px-8">
          <div>
            <h2 className="text-2xl">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-4">
            {aside}
            <button
              onClick={onClose}
              className="btn btn-sm"
            >
              Done
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
