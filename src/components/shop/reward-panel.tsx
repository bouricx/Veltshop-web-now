import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getRewardCampaign, playCampaign } from "@/lib/shop/rewards";
import { useShop } from "@/lib/shop/store";
import { Button } from "@/components/ui/button";
export function RewardPanel({ id }: { id: "wheel" | "box" }) {
  const [campaign, setCampaign] = useState<Awaited<ReturnType<typeof getRewardCampaign>>>(null),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void getRewardCampaign({ data: { id } })
      .then(setCampaign)
      .catch(() => setMessage("โหลดกิจกรรมไม่สำเร็จ"));
  }, [id]);
  if (!campaign?.active)
    return <p className="mt-6 text-sm text-muted">{message || "กิจกรรมยังไม่เปิดให้บริการ"}</p>;
  const total = campaign.prizes.reduce((n, p) => n + p.weight, 0);
  return (
    <div className="mt-6 space-y-4 rounded-2xl bg-surface p-5">
      <h2 className="font-medium">{campaign.title}</h2>
      <p className="text-sm">
        ค่าเข้าร่วม {campaign.cost} บาท · สูงสุด {campaign.dailyLimit} ครั้งต่อวัน
      </p>
      <ul className="space-y-2 text-sm">
        {campaign.prizes.map((p, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {p.label} · เครดิต {p.credit} บาท
            </span>
            <span>{((p.weight / total) * 100).toFixed(2)}%</span>
          </li>
        ))}
      </ul>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void playCampaign({ data: { id, key } })
            .then((r) => {
              if (r.ok) {
                useShop.setState({ balance: r.result.balance });
                setMessage(`ได้รับเครดิต ${r.result.reward} บาท`);
                setKey(crypto.randomUUID());
                toast.success("รับรางวัลแล้ว");
              } else {
                setMessage(r.message);
                toast.error(r.message);
              }
            })
            .catch(() => setMessage("กรุณาลองคำขอเดิมอีกครั้ง"))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "กำลังเปิดรางวัล…" : id === "wheel" ? "หมุนกงล้อ" : "เปิดกล่อง"}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
