import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-raised disabled:text-muted",
  secondary:
    "bg-raised text-ink hover:bg-line disabled:text-muted",
  danger:
    "border border-negative/30 bg-card text-negative hover:bg-negative-bg disabled:opacity-50",
  outline:
    "border border-control bg-card text-ink hover:bg-background disabled:text-muted",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed sm:w-auto ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
