import Link from "next/link";
import { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "border-app-accent bg-app-accent text-white shadow-app-accent hover:border-app-accent-hover hover:bg-app-accent-hover hover:shadow-app-accent-hover active:border-app-accent-hover active:bg-app-accent-hover",
  secondary:
    "border-app-border-soft bg-app-surface-solid text-app-text-primary shadow-app-card hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card",
  ghost:
    "border-transparent bg-transparent text-app-text-secondary hover:bg-app-surface-hover hover:text-app-text-primary"
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-sm border px-4 py-2 text-sm font-semibold backdrop-blur-xl transition-[background-color,border-color,box-shadow,color,transform] duration-300 ease-[var(--app-motion-standard)] active:scale-[0.992] disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  children,
  className,
  onClick,
  variant = "primary"
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  variant?: keyof typeof variants;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-sm border px-4 py-2 text-sm font-semibold backdrop-blur-xl transition-[background-color,border-color,box-shadow,color,transform] duration-300 ease-[var(--app-motion-standard)] active:scale-[0.992]",
        variants[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}
