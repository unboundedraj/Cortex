/**
 * Remembers the last page the notes list navigated to, in client memory.
 * Module state survives client-side navigations but not reloads or new
 * tabs, which is exactly the signal a Back control needs: "the previous
 * history entry is the list, so router.back() will restore its filters".
 * Only call these from client code.
 */
let lastPathFromList: string | null = null;

function normalizePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

export function rememberListNavigation(href: string): void {
  lastPathFromList = normalizePath(href.split(/[?#]/)[0]);
}

export function arrivedFromList(): boolean {
  return (
    lastPathFromList !== null &&
    window.history.length > 1 &&
    normalizePath(window.location.pathname) === lastPathFromList
  );
}
