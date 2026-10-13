import { getVercelOidcTokenSync } from "@vercel/oidc";

/** OIDC is supplied in the Vercel request context, not necessarily process.env. */
export function gatewayConfigured(): boolean {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true;
  try {
    return Boolean(getVercelOidcTokenSync());
  } catch {
    return false;
  }
}
