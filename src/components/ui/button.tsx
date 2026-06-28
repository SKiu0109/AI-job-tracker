import Link from "next/link";
import { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover active:bg-accent-strong active:border-accent-strong",
  secondary:
    "border bg-tertiary text-primary hover:border-strong hover:bg-hover",
  ghost:
    "border-transparent bg-transparent text-secondary hover:bg-hover hover:text-primary"
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
        "inline-flex min-h-10 items-center justify-center rounded-app border px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
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
        "inline-flex min-h-10 items-center justify-center rounded-app border px-4 py-2 text-sm font-semibold transition duration-200",
        variants[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}
