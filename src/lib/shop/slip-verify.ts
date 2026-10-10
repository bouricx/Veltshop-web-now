/**
 * In-house slip verification (OCR + match gate).
 * No SlipOK / Thunder / Slip2Go dependency.
 *
 * OCR via tesseract.js. Thai bank slips vary; low-confidence / uncertain
 * matches MUST fail closed (do not release codes or credit).
 */

export const SHOP_PROMPTPAY = "0928160016";

export type SlipMatchStatus = "verified" | "rejected" | "uncertain";

export type SlipMatchResult = {
  status: SlipMatchStatus;
  matchedAmount: boolean;
  matchedAccount: boolean;
  confidence: "high" | "low";
  reason: string;
  ocrText: string;
  amountsFound: number[];
  accountsFound: string[];
  expectedAmount: number;
  expectedAccount: string;
};

/** Digits only — PromptPay / account compare. */
export function normalizeAccount(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/** Pull baht amounts from OCR text (supports 1,234.56 and 1234). */
export function extractAmounts(text: string): number[] {
  const found = new Set<number>();
  const re =
    /(?:฿|บาท|THB|Amount|จำนวน|นเงิน|เงิน)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 1 && n <= 1_000_000) found.add(Math.round(n * 100) / 100);
  }
  return [...found];
}

/** Pull likely account / PromptPay numbers (10–13 digits, allow dashes/spaces). */
export function extractAccounts(text: string): string[] {
  const found = new Set<string>();
  const re = /\b(\d(?:[\d\s-]{8,18})\d)\b/g;
  for (const m of text.matchAll(re)) {
    const digits = normalizeAccount(m[1]);
    if (digits.length >= 10 && digits.length <= 13) found.add(digits);
  }
  // Also sticky 10-digit sequences without separators
  for (const m of text.matchAll(/\d{10,13}/g)) found.add(m[0]);
  return [...found];
}

function amountClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.009;
}

/**
 * Pure match gate from OCR text. Fail closed when uncertain.
 */
export function matchSlipText(input: {
  ocrText: string;
  expectedAmount: number;
  expectedAccount?: string;
}): SlipMatchResult {
  const expectedAccount = normalizeAccount(input.expectedAccount || SHOP_PROMPTPAY);
  const expectedAmount = Math.round(Number(input.expectedAmount) || 0);
  const ocrText = input.ocrText || "";
  const amountsFound = extractAmounts(ocrText);
  const accountsFound = extractAccounts(ocrText);

  const matchedAmount =
    expectedAmount > 0 && amountsFound.some((a) => amountClose(a, expectedAmount));
  const matchedAccount =
    expectedAccount.length >= 10 &&
    accountsFound.some(
      (a) => a === expectedAccount || a.endsWith(expectedAccount) || expectedAccount.endsWith(a),
    );

  if (!ocrText.trim()) {
    return {
      status: "uncertain",
      matchedAmount: false,
      matchedAccount: false,
      confidence: "low",
      reason: "OCR returned empty text",
      ocrText,
      amountsFound,
      accountsFound,
      expectedAmount,
      expectedAccount,
    };
  }

  if (matchedAmount && matchedAccount) {
    return {
      status: "verified",
      matchedAmount: true,
      matchedAccount: true,
      confidence: "high",
      reason: "Amount and destination account matched OCR text",
      ocrText,
      amountsFound,
      accountsFound,
      expectedAmount,
      expectedAccount,
    };
  }

  if (!matchedAmount && !matchedAccount) {
    return {
      status: "rejected",
      matchedAmount: false,
      matchedAccount: false,
      confidence: amountsFound.length || accountsFound.length ? "high" : "low",
      reason: "Neither amount nor destination account found in slip OCR",
      ocrText,
      amountsFound,
      accountsFound,
      expectedAmount,
      expectedAccount,
    };
  }

  // Only one side matched — do NOT release (uncertain / partial)
  return {
    status: "uncertain",
    matchedAmount,
    matchedAccount,
    confidence: "low",
    reason: matchedAmount
      ? "Amount matched but destination account not found"
      : "Destination account matched but amount not found",
    ocrText,
    amountsFound,
    accountsFound,
    expectedAmount,
    expectedAccount,
  };
}

/** Run tesseract.js OCR on an image buffer/blob. */
export async function ocrSlipImage(
  image: Buffer | Uint8Array | ArrayBuffer | Blob,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng+tha", 1, {
    // Keep logs quiet in server
    logger: () => {},
  });
  try {
    // Tesseract's Node typings accept Buffer, while this facade also supports
    // browser-friendly ArrayBuffer / Uint8Array / Blob inputs.
    let input: Buffer;
    if (Buffer.isBuffer(image)) input = image;
    else if (image instanceof Blob) input = Buffer.from(await image.arrayBuffer());
    else if (image instanceof ArrayBuffer) input = Buffer.from(image);
    else input = Buffer.from(image);
    const { data } = await worker.recognize(input);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

export async function verifySlipImage(input: {
  image: Buffer | Uint8Array | ArrayBuffer | Blob;
  expectedAmount: number;
  expectedAccount?: string;
}): Promise<SlipMatchResult> {
  let ocrText = "";
  try {
    ocrText = await ocrSlipImage(input.image);
  } catch (err) {
    return {
      status: "uncertain",
      matchedAmount: false,
      matchedAccount: false,
      confidence: "low",
      reason: `OCR failed: ${err instanceof Error ? err.message : "unknown error"}`,
      ocrText: "",
      amountsFound: [],
      accountsFound: [],
      expectedAmount: Math.round(Number(input.expectedAmount) || 0),
      expectedAccount: normalizeAccount(input.expectedAccount || SHOP_PROMPTPAY),
    };
  }
  return matchSlipText({
    ocrText,
    expectedAmount: input.expectedAmount,
    expectedAccount: input.expectedAccount,
  });
}
