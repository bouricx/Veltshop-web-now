/**
 * Admin privilege check — separate from customer accounts.
 *
 * Set comma-separated admin emails via server env `ADMIN_EMAILS` (or single
 * `ADMIN_EMAIL`). Never put passwords here; customers/admins register through
 * Better Auth which stores scrypt password hashes only.
 */
export function adminEmailList(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim() || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = adminEmailList();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}
