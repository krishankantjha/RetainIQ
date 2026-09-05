import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { searchCustomers } from "@/lib/api";

type GlobalSearchProps = {
  inputRef?: RefObject<HTMLInputElement | null>;
};

type PageShortcut = {
  label: string;
  path: string;
  keywords: string[];
};

const PAGE_SHORTCUTS: PageShortcut[] = [
  { label: "Dashboard", path: "/dashboard", keywords: ["dashboard", "home", "overview"] },
  { label: "At-risk subscribers", path: "/at-risk", keywords: ["at-risk", "at risk", "high risk"] },
  { label: "Trends", path: "/analytics", keywords: ["analytics", "trends", "segments", "subscribers"] },
  { label: "Interventions", path: "/save-plays", keywords: ["save plays", "interventions", "plays"] },
  { label: "Data explorer", path: "/explorer", keywords: ["explorer", "browse", "table"] },
  { label: "What-if lab", path: "/what-if", keywords: ["what-if", "what if", "counterfactual", "simulate"] },
  { label: "Executive summary", path: "/reports", keywords: ["executive", "reports", "summary"] },
  { label: "Model diagnostics", path: "/diagnostics", keywords: ["diagnostics", "drift", "model health"] },
  { label: "Settings", path: "/settings", keywords: ["settings", "profile", "account"] },
  { label: "Upload data", path: "/upload", keywords: ["upload", "csv", "import"] },
];

export default function GlobalSearch({ inputRef }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const trimmed = query.trim();
  const pageMatches = useMemo(() => {
    if (trimmed.length < 2) return [];
    const lower = trimmed.toLowerCase();
    return PAGE_SHORTCUTS.filter((page) =>
      page.keywords.some((keyword) => keyword.includes(lower) || lower.includes(keyword)),
    );
  }, [trimmed]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCustomers(trimmed)
        .then((ids) => {
          setResults(ids);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [trimmed]);

  const selectCustomer = (customerId: string) => {
    setQuery("");
    setOpen(false);
    setFocused(false);
    navigate(`/subscribers/${encodeURIComponent(customerId)}`);
  };

  const selectPage = (path: string) => {
    setQuery("");
    setOpen(false);
    setFocused(false);
    navigate(path);
  };

  const showDropdown =
    open && (loading || results.length > 0 || pageMatches.length > 0 || trimmed.length >= 2);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (results.length > 0 || pageMatches.length > 0) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder="Search subscribers by ID or jump to a page…"
          className="h-10 w-full rounded-xl border border-border/70 bg-surface-low/80 pl-10 pr-14 text-sm placeholder:text-muted-foreground transition-colors focus:border-primary/45 focus:bg-surface-low focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="Global search"
          autoComplete="off"
        />
        <kbd
          className={`pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/80 bg-surface-high/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block ${
            focused ? "opacity-0" : "opacity-100"
          }`}
        >
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <ul
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-border/80 bg-surface-low py-1 shadow-xl"
          role="listbox"
        >
          {pageMatches.length > 0 && (
            <>
              <li className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pages
              </li>
              {pageMatches.map((page) => (
                <li key={page.path}>
                  <button
                    type="button"
                    role="option"
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectPage(page.path)}
                  >
                    {page.label}
                  </button>
                </li>
              ))}
            </>
          )}

          {trimmed.length >= 2 && (
            <li className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Subscribers
            </li>
          )}

          {loading && (
            <li className="px-4 py-2.5 text-sm text-muted-foreground">Searching…</li>
          )}
          {!loading && trimmed.length >= 2 && results.length === 0 && (
            <li className="px-4 py-2.5 text-sm text-muted-foreground">No subscriber matches</li>
          )}
          {!loading &&
            results.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCustomer(id)}
                >
                  {id}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
