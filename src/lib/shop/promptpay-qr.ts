/**
 * Build EMVCo PromptPay QR payload (Thai mobile / national ID) and render a PNG data URL.
 */
import QRCode from "qrcode";

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/** CRC-16/CCITT-FALSE used by EMV QR. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Normalize PromptPay target: 0XXXXXXXXX → 0066XXXXXXXXX; 13-digit tax ID as-is. */
export function formatPromptPayTarget(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 13) return d;
  if (d.length === 10 && d.startsWith("0")) return `0066${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("66")) return `00${d}`;
  if (d.length === 13 && d.startsWith("0066")) return d;
  if (d.startsWith("0066")) return d;
  return d;
}

export function buildPromptPayPayload(account: string, amount?: number): string {
  const target = formatPromptPayTarget(account);
  if (target.length < 11) {
    throw new Error("หมายเลขพร้อมเพย์ไม่ถูกต้อง");
  }
  const merchantInfo = tlv("00", "A000000677010111") + tlv("01", target);
  const amountStr = amount != null && amount > 0 ? Number(amount).toFixed(2) : "";
  let payload =
    tlv("00", "01") +
    tlv("01", amountStr ? "12" : "11") +
    tlv("29", merchantInfo) +
    tlv("53", "764") +
    tlv("58", "TH");
  if (amountStr) payload += tlv("54", amountStr);
  payload += "6304";
  return payload + crc16(payload);
}

export async function promptPayQrDataUrl(account: string, amount?: number): Promise<string> {
  const payload = buildPromptPayPayload(account, amount);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });
}
