/**
 * Validates that `from` is a same-origin, relative path before using it as
 * a post-login redirect target. Without this, a crafted `from` query param
 * (an absolute URL, "//evil.com", or "/\evil.com" — some browsers treat a
 * leading backslash like a second forward slash) becomes an open redirect:
 * a link to OUR /login page that, after a real login, sends the victim
 * somewhere attacker-controlled while carrying the credibility of having
 * just authenticated on the real site.
 */
export function resolveSafeRedirect(
  from: string | null,
  origin: string,
): string {
  if (!from) return "/";
  if (
    !from.startsWith("/") ||
    from.startsWith("//") ||
    from.startsWith("/\\")
  ) {
    return "/";
  }
  try {
    const resolved = new URL(from, origin);
    if (resolved.origin !== origin) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}
