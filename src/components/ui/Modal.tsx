"use client";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZE_MAP: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

interface Props {
  /** When omitted the modal is always mounted (controlled by parent render) */
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "sm" | "md" | "lg" | "xl" or any Tailwind max-w class */
  size?: string;
  /** Legacy alias for size (accepts a Tailwind max-w class) */
  maxWidth?: string;
  className?: string;
  zIndex?: number;
}

export default function Modal({
  open = true,
  onClose,
  children,
  size,
  maxWidth,
  className,
  zIndex = 1000,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const resolvedMax = size
    ? (SIZE_MAP[size] ?? size)
    : (maxWidth ?? "max-w-2xl");

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
      style={{ zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          "bg-white rounded-2xl shadow-modal w-full max-h-[92vh] overflow-auto",
          resolvedMax,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  label,
  labelColor,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  label?: string;
  labelColor?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
      <div>
        {label && (
          <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: labelColor }}>
            {label}
          </p>
        )}
        <h2 className="text-[17px] font-extrabold text-slate-900">{title}</h2>
        {subtitle && <div className="mt-0.5">{typeof subtitle === "string" ? <p className="text-xs text-slate-400">{subtitle}</p> : subtitle}</div>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <button
          onClick={onClose}
          className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 text-lg transition-colors cursor-pointer border-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
