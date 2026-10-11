export const MAX_SLIP_BYTES = 3 * 1024 * 1024;
export const PAYMENT_WINDOW_SECONDS = 300;

/** PromptPay proxies supported by this checkout (phone and national/tax ID). */
export function promptPayAccount(raw: string) {
  const digits = raw.replace(/[\s-]/g, "");
  if (/^0\d{9}$/.test(digits))
    return { number: digits, target: `0066${digits.slice(1)}`, tag: "01", accountType: "02001" };
  if (/^(?:00)?66\d{9}$/.test(digits)) {
    const number = `0${digits.slice(-9)}`;
    return { number, target: `0066${number.slice(1)}`, tag: "01", accountType: "02001" };
  }
  if (/^\d{13}$/.test(digits))
    return { number: digits, target: digits, tag: "02", accountType: "02003" };
  return null;
}

export type CheckoutReadiness = {
  available: boolean;
  verification: "automatic" | "manual";
  message: string;
};
