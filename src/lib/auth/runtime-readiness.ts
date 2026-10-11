export function authRuntimeReadiness(env: Record<string, string | undefined>) {
  const deployed = env.VERCEL === "1" || env.NODE_ENV === "production";
  const missing = deployed
    ? ["BETTER_AUTH_SECRET", "DATABASE_URL"].filter((key) => !env[key]?.trim())
    : [];
  return { ready: missing.length === 0, missing };
}
