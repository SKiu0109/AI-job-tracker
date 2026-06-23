import { ReactNode } from "react";

export function DetailSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-line bg-white p-4 shadow-soft">
      <h2 className="text-base font-semibold tracking-normal text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
