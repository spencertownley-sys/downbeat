/**
 * This device's memory of which member it is in each band, so /join/[slug]
 * can offer "Welcome back". The personal link itself is the credential; this
 * is only a convenience, and every call tolerates storage being unavailable.
 */
function key(slug: string) {
  return `downbeat:member:${slug}`;
}

export function rememberMember(slug: string, token: string, name: string) {
  try {
    localStorage.setItem(key(slug), JSON.stringify({ token, name }));
  } catch {
    // localStorage unavailable — the URL itself still works fine.
  }
}

export function recallMember(slug: string): { token: string; name: string } | null {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Forgets the remembered member if it's this (now dead) token, e.g. after recovering elsewhere. */
export function forgetMemberIfToken(slug: string, token: string) {
  try {
    if (recallMember(slug)?.token === token) localStorage.removeItem(key(slug));
  } catch {
    // Nothing to clean up.
  }
}
