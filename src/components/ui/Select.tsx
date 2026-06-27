import { cn } from "@/lib/utils";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, error, className, children, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="field-label">{label}</label>}
      <select
        ref={ref}
        className={cn(
          "input-base bg-white",
          error && "border-red-400",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-red-500 text-[10px] mt-1">{error}</p>}
    </div>
  )
);
Select.displayName = "Select";
export default Select;
