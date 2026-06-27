import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
type Size    = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:   "bg-blue-500 hover:bg-blue-600 text-white",
  secondary: "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200",
  danger:    "bg-red-500 hover:bg-red-600 text-white",
  ghost:     "bg-transparent hover:bg-slate-100 text-slate-600",
  success:   "bg-emerald-500 hover:bg-emerald-600 text-white",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2 rounded-lg",
  lg: "text-sm px-5 py-2.5 rounded-xl",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "font-semibold transition-colors cursor-pointer border-none inline-flex items-center gap-2 justify-center",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
