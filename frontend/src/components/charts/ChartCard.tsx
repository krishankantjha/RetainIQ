import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  contentClassName?: string;
};

export default function ChartCard({
  title,
  description,
  children,
  empty = false,
  emptyMessage = "Upload and score subscribers to see this chart.",
  contentClassName = "h-64",
}: ChartCardProps) {
  return (
    <div className="dash-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className={`mt-5 ${contentClassName}`}>
        {empty ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
