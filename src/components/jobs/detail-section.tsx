import { ReactNode } from "react";
import { AppCard } from "@/components/ui/app-card";

export function DetailSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AppCard as="section" className="app-hover-lift p-4" variant="elevated">
      <h2 className="text-base font-semibold tracking-normal text-app-text-primary">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </AppCard>
  );
}
