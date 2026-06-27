import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  color: string;
  className?: string;
  size?: "xs" | "sm";
}

export default function Badge({ children, color, className, size = "xs" }: Props) {
  return (
    <span
      className={cn("badge font-bold", size === "xs" ? "text-[10px]" : "text-xs", className)}
      style={{ background: color + "22", color }}
    >
      {children}
    </span>
  );
}
