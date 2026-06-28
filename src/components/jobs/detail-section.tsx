import { ReactNode } from "react";

export function DetailSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-black/[0.06] bg-tertiary p-4">
      <h2 className="text-base font-semibold tracking-normal text-primary">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
