import { createFileRoute } from "@tanstack/react-router";
import { useSiteConfiguration } from "@/lib/shop/site-state";
export const Route = createFileRoute("/shop/privacy")({ component: Privacy });
function Privacy() {
  const { value } = useSiteConfiguration();
  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">นโยบายความเป็นส่วนตัว / เงื่อนไข</h1>
      <p className="whitespace-pre-wrap text-sm">{value.privacy}</p>
      <h2 className="font-medium">เงื่อนไขเติมเงิน</h2>
      <p className="whitespace-pre-wrap text-sm">{value.terms}</p>
      <h2 className="font-medium">ขั้นตอนขอคืนเครดิต</h2>
      <p className="whitespace-pre-wrap text-sm">{value.refundText}</p>
      <p className="text-sm">
        ขอสำเนาข้อมูลหรือลบบัญชีผ่าน Discord / Facebook ของร้าน
        ข้อมูลธุรกรรมที่จำเป็นจะถูกเก็บตามนโยบายที่ร้านกำหนด
      </p>
    </article>
  );
}
