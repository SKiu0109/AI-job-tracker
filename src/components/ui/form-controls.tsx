import {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-semibold leading-none text-app-text-primary",
        className
      )}
      {...props}
    />
  );
}

// Shared input base: soft macOS-style control surface.
const inputBase =
  "min-h-10 w-full rounded-sm bg-app-surface-solid px-3 py-2 text-sm text-app-text-primary shadow-app-card outline-none backdrop-blur-xl transition-[background-color,box-shadow,transform] duration-300 ease-[var(--app-motion-standard)] placeholder:text-app-text-tertiary hover:bg-app-surface-hover hover:shadow-app-card focus:bg-app-surface-solid focus:shadow-app-focus";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(inputBase, className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        inputBase,
        "leading-6",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(inputBase, className)}
      {...props}
    />
  );
}
