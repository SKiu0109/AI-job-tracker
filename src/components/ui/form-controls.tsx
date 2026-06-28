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
        "text-sm font-semibold leading-none text-primary",
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-10 w-full rounded-app border bg-tertiary px-3 py-2 text-sm text-primary outline-none transition duration-200 placeholder:text-tertiary hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent-subtle",
        className
      )}
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
        "w-full rounded-app border bg-tertiary px-3 py-2 text-sm leading-6 text-primary outline-none transition duration-200 placeholder:text-tertiary hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent-subtle",
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
      className={cn(
        "min-h-10 rounded-app border bg-tertiary px-3 py-2 text-sm text-primary outline-none transition duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent-subtle",
        className
      )}
      {...props}
    />
  );
}
