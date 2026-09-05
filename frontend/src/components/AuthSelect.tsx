import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type AuthSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  className?: string;
};

export default function AuthSelect({
  id,
  value,
  onChange,
  options,
  className = "",
}: AuthSelectProps) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={selectId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="auth-input flex items-center justify-between px-3 text-left"
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={selectId}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface-low py-1 shadow-card"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={[
                    "w-full px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-primary/15 font-medium text-foreground"
                      : "text-foreground hover:bg-surface-high/80",
                  ].join(" ")}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
