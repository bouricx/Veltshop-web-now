/** Image normalization for the official server-side Slip2Go adapter. */
const configuredReceiver = process.env.PROMPTPAY_RECEIVER?.trim();
if (configuredReceiver && !/^(?:\d{10}|\d{13})$/.test(configuredReceiver))
  throw new Error("Invalid PROMPTPAY_RECEIVER");
export const VERIFIER_PROMPTPAY = configuredReceiver || "0928160016";

/** Parse a data-URL or raw base64 image into a Blob for upstream upload. */
export function slipImageToBlob(
  dataUrlOrBase64: string,
  mimeHint?: string,
): { blob: Blob; fileName: string } | null {
  const raw = (dataUrlOrBase64 || "").trim();
  if (!raw) return null;
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(raw);
  let mime = mimeHint || "image/png";
  let b64: string;
  let ext = "png";
  if (m) {
    mime = m[1].toLowerCase();
    ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
    b64 = m[3];
  } else if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 64) {
    b64 = raw;
    if (mimeHint?.includes("jpeg") || mimeHint?.includes("jpg")) ext = "jpg";
    else if (mimeHint?.includes("webp")) ext = "webp";
    else if (mimeHint?.includes("gif")) ext = "gif";
  } else {
    return null;
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength < 32 || buf.byteLength > 5 * 1024 * 1024) return null;
  return {
    blob: new Blob([new Uint8Array(buf)], { type: mime }),
    fileName: `slip.${ext}`,
  };
}
