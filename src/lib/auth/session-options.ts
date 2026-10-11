export const sessionCookieOptions = {
  useSecureCookies: false,
  defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
  cookies: {
    session_token: { name: "__Host-grok-auth.session_token" },
    session_data: { name: "__Host-grok-auth.session_data" },
    account_data: { name: "__Host-grok-auth.account_data" },
    dont_remember: { name: "__Host-grok-auth.dont_remember" },
  },
} as const;
