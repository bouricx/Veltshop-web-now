import { verifySlip2Go, type SlipResult } from "./slip2go.server.ts";
import { CommerceError } from "./commerce.server.ts";
export interface PaymentProvider {
  id: "slip2go" | "promptpay" | "trueMoneyGift";
  mode: "automatic-slip" | "manual-gift";
  verify(input: {
    file?: Blob;
    fileName?: string;
    amount: number;
    receiver: string;
    giftUrl?: string;
  }): Promise<SlipResult>;
}
const slipVerify: PaymentProvider["verify"] = async (input) => {
  if (!input.file || !Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new CommerceError("ข้อมูลตรวจสลิปไม่ครบ");
  return verifySlip2Go(input.file, input.fileName ?? "slip.png", input.amount, input.receiver);
};
export const paymentProviders: Record<PaymentProvider["id"], PaymentProvider> = {
  slip2go: { id: "slip2go", mode: "automatic-slip", verify: slipVerify },
  promptpay: { id: "promptpay", mode: "automatic-slip", verify: slipVerify },
  trueMoneyGift: {
    id: "trueMoneyGift",
    mode: "manual-gift",
    verify: async () => ({
      ok: false,
      amount: null,
      reference: null,
      reason: "รอทีมงานตรวจสอบผ่านช่องทางที่ได้รับอนุญาต",
    }),
  },
};
