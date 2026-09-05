export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatModelSignal(value: number, digits = 3): string {
  return value.toFixed(digits);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function greetingForHour(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Friendly display name — prefers stored full name, then email local-part. */
export function displayNameFromProfile(
  email: string | null | undefined,
  fullName?: string | null,
): string {
  const name = (fullName ?? "").trim();
  if (name) return name;
  return formatDisplayName(email);
}

/** First name for greetings — uses full name when available. */
export function greetingName(
  email: string | null | undefined,
  fullName?: string | null,
): string {
  const name = displayNameFromProfile(email, fullName);
  const first = name.split(/\s+/)[0] ?? name;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Friendly name for greetings — uses the username the user signed up or logged in with. */
export function formatDisplayName(username: string | null | undefined): string {
  const trimmed = (username ?? "").trim();
  if (!trimmed) return "there";
  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0] ?? trimmed;
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  if (trimmed.includes(" ")) {
    return trimmed
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function userContactEmail(identifier: string | null | undefined): string {
  const trimmed = (identifier ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return `${trimmed.toLowerCase()}@retainiq.app`;
}

export function userInitial(username: string | null | undefined, fullName?: string | null): string {
  const name = displayNameFromProfile(username, fullName);
  return name.charAt(0).toUpperCase();
}

export function formatFeatureName(feature: string): string {
  return feature
    .replace(/^numeric__/, "")
    .replace(/^categorical__/, "")
    .replace(/^binary__/, "")
    .replace(/^ordinal__/, "")
    .replace(/_/g, " ");
}
