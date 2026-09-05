export function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    high: get("--risk-high", "#e85d5d"),
    medium: get("--risk-medium", "#e8a84d"),
    low: get("--risk-low", "#4db88a"),
    primary: get("--primary", "#7c6df0"),
    muted: get("--muted-foreground", "#9aa3b2"),
    border: get("--border", "#3a3f4b"),
    foreground: get("--foreground", "#f0f0f5"),
  };
}
