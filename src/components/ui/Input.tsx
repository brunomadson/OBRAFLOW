import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="field-label">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          "input-base",
          error && "border-red-400 focus:border-red-400 focus:ring-red-100",
          className
        )}
        {...props}
      />
      {error && <p className="text-red-500 text-[10px] mt-1">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
export default Input;
