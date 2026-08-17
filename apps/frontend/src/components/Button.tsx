import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-accent-light",
  secondary:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  outline:
    "border border-slate-300 bg-card text-slate-800 hover:bg-background disabled:text-slate-400",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed sm:w-auto ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
