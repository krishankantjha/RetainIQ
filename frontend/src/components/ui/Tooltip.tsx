import type { ReactNode } from "react";

type TooltipPlacement = "top" | "right" | "bottom";

type TooltipProps = {
  content: string;
  children: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
};

const PLACEMENT: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
};

export default function Tooltip({
  content,
  children,
  placement = "top",
  className = "",
}: TooltipProps) {
  return (
    <span
      className={`group/tooltip relative inline-flex max-w-full ${className}`}
      title={content}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[200] w-max max-w-[12rem] rounded-lg border border-border/80 bg-surface-low px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-foreground shadow-lg opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${PLACEMENT[placement]}`}
      >
        {content}
      </span>
    </span>
  );
}
