import { onShopChange } from "@/lib/shop/realtime-client";
import { getPaymentSlipEvidence } from "@/lib/shop/actions";
import { addDigitalInventory } from "@/lib/shop/inventory";
import { DataImport } from "./data-import";
import { getRewardCampaign, saveRewardCampaign } from "@/lib/shop/rewards";
import { backupNow, listBackups, downloadBackup, verifyBackup } from "@/lib/shop/backups";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminRecords,
  dashboardData,
  systemHealth,
  disableGift,
  changeInventoryStatus,
  type RecordKind,
} from "@/lib/shop/admin-data";
import {
  adjustWallet,
  refundOrderAction,
  deliverOrderAction,
  resolveClaim,
  reviewTopup,
  setMember,
  createGiftCode,
  saveCoupon,
  saveContent,
  getSiteConfiguration,
  getManualGift,
  saveSiteConfiguration,
} from "@/lib/shop/operations";
import { updateAccess } from "@/lib/shop/access";
import { listMedia, deleteMedia } from "@/lib/shop/media";
import { runJobs, retryJob } from "@/lib/shop/jobs";
import { ImageEditor } from "./image-editor";
import type { SiteConfiguration } from "@/lib/shop/settings-schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea, NativeSelect } from "@/components/ui/input";
type Row = Record<string, string | number | boolean | null>;
type Field = {
  name: string;
  label: string;
  type?: "number" | "text" | "textarea" | "checkbox" | "datetime" | "select";
  value?: string | number | boolean | null;
  options?: string[];
  required?: boolean;
};
type Action = {
  title: string;
  fields: Field[];
  run: (value: Record<string, string | number | boolean | null>) => Promise<unknown>;
};
const labels: Record<string, string> = {
  id: "รหัส",
  user_id: "สมาชิก",
  order_id: "ออเดอร์",
  created_at: "วันที่",
  name: "ชื่อ",
  email: "อีเมล",
  rank: "ระดับสมาชิก",
  balance: "เครดิต",
  spending: "ยอดซื้อสะสม",
  orders: "ออเดอร์",
  status: "สถานะ",
  total: "ยอดสุทธิ",
  subtotal: "ยอดก่อนส่วนลด",
  product_name: "สินค้า",
  product_id: "รหัสสินค้า",
  amount: "ยอดเงิน",
  fee: "ค่าธรรมเนียม",
  credit: "เครดิตสุทธิ",
  method: "ช่องทาง",
  provider: "ผู้ให้บริการ",
  provider_reference: "อ้างอิง",
  title: "หัวข้อ",
  reply: "คำตอบ",
  message: "รายละเอียด",
  warranty_end: "สิ้นสุดประกัน",
  last_login: "เข้าสู่ระบบล่าสุด",
  disabled: "ปิดบัญชี",
  active: "เปิดใช้งาน",
  label: "ชื่อโค้ด",
  used: "ใช้แล้ว",
  usage_limit: "จำนวนสิทธิ์",
  reward: "รางวัล",
  code: "โค้ด",
  kind: "ประเภท",
  minimum: "ยอดขั้นต่ำ",
  per_user_limit: "สิทธิ์ต่อคน",
  action: "การกระทำ",
  actor_id: "ผู้ดำเนินการ",
  entity_type: "ประเภทข้อมูล",
  entity_id: "ข้อมูลที่เกี่ยวข้อง",
  metadata: "รายละเอียดการเปลี่ยนแปลง",
  customer_input: "ข้อมูลผู้รับ",
  expires_at: "หมดอายุ",
  priority: "ลำดับ",
  attempts: "จำนวนครั้ง",
  last_error: "ข้อผิดพลาด",
  available_at: "ทำงานครั้งถัดไป",
  body: "ข้อความ",
  image: "รูปภาพ",
  link: "ลิงก์",
  audience: "ผู้รับ",
  starts_at: "เริ่ม",
  ends_at: "สิ้นสุด",
};
const field = (
  name: string,
  label: string,
  type: Field["type"] = "text",
  value: Field["value"] = "",
  options?: string[],
): Field => ({ name, label, type, value, options });
async function result(work: Promise<unknown>) {
  const r = (await work) as { ok?: boolean; message?: string; result?: unknown };
  if (r.ok === false) throw new Error(r.message ?? "ทำรายการไม่สำเร็จ");
  return r.result ?? r;
}
function csv(rows: Row[]) {
  const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== "total_rows");
  const encode = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      keys.map((k) => encode(labels[k] ?? k)).join(","),
      ...rows.map((r) => keys.map((k) => encode(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function AdminRecords({
  kind,
  permissions,
  initialStatus,
}: {
  kind: RecordKind;
  permissions: string[];
  initialStatus?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [status, setStatus] = useState(initialStatus ?? ""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [descending, setDescending] = useState(true),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [action, setAction] = useState<Action | null>(null),
    [refresh, setRefresh] = useState(0);
  const can = (p: string) => permissions.includes("*") || permissions.includes(p);
  const query = {
    kind,
    search,
    page,
    size: 30,
    status,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to + "T23:59:59+07:00").toISOString() : null,
    descending,
  };
  useEffect(() => {
    let active = true;
    const load = () =>
      void adminRecords({
        data: {
          kind,
          search,
          page,
          size: 30,
          status,
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(to + "T23:59:59+07:00").toISOString() : null,
          descending,
        },
      })
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setTotal(r.total);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("โหลดข้อมูลไม่สำเร็จหรือไม่มีสิทธิ์");
        });
    load();
    const unsubscribe = onShopChange(load);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, [kind, search, page, status, from, to, descending, refresh]);
  async function exportAll() {
    try {
      const all: Row[] = [];
      for (let p = 0; p < 10000; p++) {
        const r = await adminRecords({ data: { ...query, page: p, size: 100 } });
        all.push(...r.rows);
        if (r.rows.length < 100) break;
      }
      const blob = new Blob([csv(all)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veltshop-${kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("ส่งออกไม่สำเร็จ");
    }
  }
  function actions(row: Row) {
    const operationKey = crypto.randomUUID();
    const id = String(row.id),
      userId = String(row.user_id ?? row.id);
    const commonReason = field("reason", "เหตุผล", "textarea");
    const list: Action[] = [];
    if (kind === "users") {
      if (can("wallet.manage"))
        list.push({
          title: "ปรับเครดิต",
          fields: [field("amount", "เพิ่มเป็นบวก / ลดเป็นลบ", "number", 0), commonReason],
          run: (v) =>
            result(
              adjustWallet({
                data: {
                  userId,
                  amount: Number(v.amount),
                  reason: String(v.reason),
                  key: operationKey,
                },
              }),
            ),
        });
      if (can("users.manage"))
        list.push({
          title: "แก้ไขสมาชิก / อนุมัติระดับ",
          fields: [
            field("name", "ชื่อ", "text", String(row.name)),
            field("rank", "ระดับสมาชิก", "select", String(row.rank), [
              "New Member",
              "VIP Member",
              "VVip",
            ]),
            field("color", "สีระดับสมาชิก", "text", String(row.color)),
            field("disabled", "ปิดบัญชี", "checkbox", Boolean(row.disabled)),
            commonReason,
          ],
          run: (v) =>
            result(
              setMember({
                data: {
                  userId,
                  name: String(v.name),
                  rank: String(v.rank),
                  color: String(v.color),
                  disabled: Boolean(v.disabled),
                  reason: String(v.reason),
                },
              }),
            ),
        });
      if (can("roles.manage"))
        list.push({
          title: "กำหนดสิทธิ์",
          fields: [
            field("role", "บทบาท", "select", "customer", [
              "customer",
              "staff",
              "admin",
              "super_admin",
            ]),
            commonReason,
          ],
          run: (v) =>
            result(
              updateAccess({
                data: {
                  userId,
                  role: String(v.role) as "customer" | "staff" | "admin" | "super_admin",
                  reason: String(v.reason),
                },
              }),
            ),
        });
    }
    if (
      kind === "payments" &&
      row.has_slip &&
      ["pending", "reconciliation_required"].includes(String(row.status))
    )
      list.push({
        title: "ดูสลิป",
        fields: [],
        run: async () => {
          const r = await getPaymentSlipEvidence({ data: { id } });
          if (!r.ok) throw Error(r.message);
          return { slipImage: r.dataUrl };
        },
      });
    if (kind === "coupons" && can("promotions.manage")) list.push(couponAction(row));
    if (kind === "orders") {
      if (row.status === "processing")
        list.push({
          title: "จัดส่งสินค้า",
          fields: [field("payload", "ข้อมูลสำหรับส่งให้ลูกค้า", "textarea")],
          run: (v) =>
            result(
              deliverOrderAction({
                data: { orderId: id, payload: String(v.payload), replacement: false },
              }),
            ),
        });
      if (row.status === "completed")
        list.push({
          title: "เปลี่ยนสินค้า",
          fields: [field("payload", "สินค้าใหม่สำหรับส่งให้ลูกค้า", "textarea")],
          run: (v) =>
            result(
              deliverOrderAction({
                data: { orderId: id, payload: String(v.payload), replacement: true },
              }),
            ),
        });
      if (can("wallet.manage") && ["processing", "completed"].includes(String(row.status)))
        list.push({
          title: "คืนเครดิต",
          fields: [commonReason],
          run: (v) =>
            result(refundOrderAction({ data: { orderId: id, reason: String(v.reason) } })),
        });
    }
    if (kind === "payments" && ["pending", "reconciliation_required"].includes(String(row.status)))
      list.push({
        title: "ตรวจสอบการเติมเงิน",
        fields: [
          field("approve", "อนุมัติหลังตรวจยอดจริง", "checkbox", false),
          field("reference", "เลขอ้างอิงธนาคาร (ต้องมีเมื่ออนุมัติ)"),
          field("verifiedAmount", "ยอดตรวจสอบจากธนาคารจริง", "number", 0),
          commonReason,
        ],
        run: (v) =>
          result(
            reviewTopup({
              data: {
                id,
                approve: Boolean(v.approve),
                verifiedAmount: Number(v.verifiedAmount),
                reference: String(v.reference),
                reason: String(v.reason),
              },
            }),
          ),
      });
    if (kind === "payments" && row.provider === "manual-gift")
      list.push({
        title: "เปิดซองเพื่อให้ทีมงานตรวจ",
        fields: [],
        run: () => getManualGift({ data: { id } }),
      });
    if (kind === "claims")
      list.push({
        title: "ตอบเคลม",
        fields: [
          field("status", "ผลการตรวจสอบ", "select", "accepted", [
            "accepted",
            "rejected",
            "closed",
            "replaced",
          ]),
          field("reply", "คำตอบ", "textarea"),
        ],
        run: (v) =>
          result(
            resolveClaim({
              data: {
                id,
                status: String(v.status) as "accepted" | "rejected" | "closed" | "replaced",
                reply: String(v.reply),
              },
            }),
          ),
      });
    if (kind === "gifts")
      list.push({
        title: row.active ? "ปิดโค้ด" : "เปิดโค้ด",
        fields: [],
        run: () => result(disableGift({ data: { id, active: !row.active } })),
      });
    if (kind === "stock" && ["available", "disabled"].includes(String(row.status)))
      list.push({
        title: row.status === "available" ? "ปิดขายชิ้นนี้" : "เปิดขายชิ้นนี้",
        fields: [],
        run: () =>
          result(
            changeInventoryStatus({
              data: { id, status: row.status === "available" ? "disabled" : "available" },
            }),
          ),
      });
    if (kind === "content") list.push(contentAction(row));
    if (kind === "jobs" && ["failed", "dead_letter"].includes(String(row.status)))
      list.push({ title: "ลองงานใหม่", fields: [], run: () => result(retryJob({ data: { id } })) });
    return list;
  }
  const create =
    kind === "gifts"
      ? giftAction()
      : kind === "coupons"
        ? couponAction()
        : kind === "content"
          ? contentAction()
          : kind === "stock" && can("stock.manage")
            ? {
                title: "เพิ่มสต็อกจริง",
                fields: [
                  field("productId", "รหัสสินค้า"),
                  field("payload", "ข้อมูลสำหรับส่งให้ลูกค้า 1 ชิ้น", "textarea"),
                ],
                run: (values: Record<string, string | number | boolean | null>) =>
                  result(
                    addDigitalInventory({
                      data: {
                        productId: String(values.productId),
                        payload: String(values.payload),
                      },
                    }),
                  ),
              }
            : null;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="sm:w-60"
          aria-label="ค้นหา"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="ค้นหาชื่อ / รหัส / สถานะ"
        />
        <Input
          className="sm:w-44"
          aria-label="กรองสถานะ"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          placeholder="กรองสถานะ"
        />
        <Input
          aria-label="วันที่เริ่ม"
          type="date"
          className="sm:w-40"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(0);
          }}
        />
        <Input
          aria-label="วันที่สิ้นสุด"
          type="date"
          className="sm:w-40"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(0);
          }}
        />
        <Button variant="secondary" onClick={() => setDescending((v) => !v)}>
          วันที่ {descending ? "ใหม่ → เก่า" : "เก่า → ใหม่"}
        </Button>
        <Button variant="secondary" onClick={() => void exportAll()}>
          ส่งออก CSV
        </Button>
        {create ? <Button onClick={() => setAction(create)}>เพิ่มรายการ</Button> : null}
      </div>
      {kind === "gifts" && can("gift_codes.manage") ? (
        <DataImport kind="gifts" onSaved={() => setRefresh((r) => r + 1)} />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted">{total} รายการ · อัปเดตทุก 15 วินาที</p>
      <div className="overflow-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {Object.keys(rows[0] ?? {})
                .filter(
                  (k) =>
                    ![
                      "total_rows",
                      "metadata",
                      "image",
                      "body",
                      "message",
                      "reply",
                      "customer_input",
                      "user_agent",
                    ].includes(k),
                )
                .map((k) => (
                  <th key={k} className="whitespace-nowrap p-3 text-left">
                    {labels[k] ?? k}
                  </th>
                ))}
              <th className="p-3">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-t border-border">
                {Object.entries(row)
                  .filter(
                    ([k]) =>
                      ![
                        "total_rows",
                        "metadata",
                        "image",
                        "body",
                        "message",
                        "reply",
                        "customer_input",
                        "user_agent",
                      ].includes(k),
                  )
                  .map(([k, v]) => (
                    <td key={k} className="max-w-56 break-words p-3">
                      {typeof v === "boolean" ? (v ? "ใช่" : "ไม่") : String(v ?? "—")}
                    </td>
                  ))}
                <td className="min-w-40 p-3">
                  <div className="flex flex-wrap gap-2">
                    {actions(row).map((a) => (
                      <Button
                        key={a.title}
                        size="sm"
                        variant="secondary"
                        onClick={() => setAction(a)}
                      >
                        {a.title}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setAction({
                          title: "รายละเอียด",
                          fields: Object.entries(row)
                            .filter(([k]) => k !== "total_rows")
                            .map(([k, v]) => field(k, labels[k] ?? k, "textarea", String(v ?? ""))),
                          run: async () => ({}),
                        })
                      }
                    >
                      รายละเอียด
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-sm text-muted">ไม่มีรายการ</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={page === 0} variant="secondary" onClick={() => setPage((p) => p - 1)}>
          ก่อนหน้า
        </Button>
        <span className="text-sm">หน้า {page + 1}</span>
        <Button
          disabled={(page + 1) * 30 >= total}
          variant="secondary"
          onClick={() => setPage((p) => p + 1)}
        >
          ถัดไป
        </Button>
      </div>
      <ActionDialog
        key={action?.title ?? "closed"}
        action={action}
        close={() => setAction(null)}
        onSaved={() => setRefresh((r) => r + 1)}
      />
    </section>
  );
}
function giftAction(): Action {
  return {
    title: "สร้างโค้ดของขวัญ",
    fields: [
      field("label", "ชื่อโค้ด"),
      field("reward", "รางวัล", "select", "credit", ["credit", "product"]),
      field("amount", "เครดิต", "number", 0),
      field("productId", "รหัสสินค้า (สำหรับรางวัลสินค้า)"),
      field("usageLimit", "จำนวนสิทธิ์", "number", 1),
      field("expiresAt", "หมดอายุ", "datetime"),
    ],
    run: (v) =>
      result(
        createGiftCode({
          data: {
            label: String(v.label),
            reward: String(v.reward) as "credit" | "product",
            amount: Number(v.amount),
            productId: v.productId ? String(v.productId) : undefined,
            usageLimit: Number(v.usageLimit),
            expiresAt: v.expiresAt ? new Date(String(v.expiresAt)).toISOString() : null,
          },
        }),
      ),
  };
}
function couponAction(row?: Row): Action {
  return {
    title: row ? "แก้ไขส่วนลด" : "สร้างส่วนลด",
    fields: [
      field("code", "โค้ด", "text", row?.code ?? ""),
      field("kind", "ประเภทส่วนลด", "select", row?.kind ?? "fixed", ["fixed", "percent"]),
      field("amount", "บาท / เปอร์เซ็นต์", "number", row?.amount ?? 1),
      field("minimum", "ยอดขั้นต่ำ", "number", row?.minimum ?? 0),
      field("productId", "รหัสสินค้า (เว้นว่าง = ทุกสินค้า)", "text", row?.product_id ?? ""),
      field("categoryId", "รหัสหมวด (เว้นว่าง = ทุกหมวด)", "text", row?.category_id ?? ""),
      field("usageLimit", "จำนวนสิทธิ์", "number", 100),
      field("perUserLimit", "สิทธิ์ต่อคน", "number", 1),
      field("active", "เปิดใช้งาน", "checkbox", true),
      field("expiresAt", "หมดอายุ", "datetime"),
    ],
    run: (v) =>
      result(
        saveCoupon({
          data: {
            code: String(v.code),
            kind: String(v.kind) as "fixed" | "percent",
            amount: Number(v.amount),
            minimum: Number(v.minimum),
            productId: v.productId ? String(v.productId) : null,
            categoryId: v.categoryId ? String(v.categoryId) : null,
            usageLimit: Number(v.usageLimit),
            perUserLimit: Number(v.perUserLimit),
            active: Boolean(v.active),
            expiresAt: v.expiresAt ? new Date(String(v.expiresAt)).toISOString() : null,
          },
        }),
      ),
  };
}
function contentAction(row?: Row): Action {
  return {
    title: row ? "แก้ไขประกาศ / แบนเนอร์" : "เพิ่มประกาศ / แบนเนอร์",
    fields: [
      field("kind", "ประเภท", "select", row?.kind ?? "banner", ["banner", "announcement"]),
      field("title", "หัวข้อ", "text", row?.title ?? ""),
      field("body", "ข้อความ", "textarea", row?.body ?? ""),
      field("image", "รูป", "text", row?.image ?? ""),
      field("link", "ลิงก์", "text", row?.link ?? ""),
      field("audience", "ผู้รับ", "select", row?.audience ?? "all", ["all", "members"]),
      field("priority", "ลำดับ", "number", row?.priority ?? 0),
      field("active", "เปิดใช้งาน", "checkbox", row?.active ?? true),
      field(
        "startsAt",
        "เริ่ม",
        "datetime",
        row?.starts_at ? String(row.starts_at).slice(0, 16) : "",
      ),
      field("endsAt", "สิ้นสุด", "datetime", row?.ends_at ? String(row.ends_at).slice(0, 16) : ""),
    ],
    run: (v) =>
      result(
        saveContent({
          data: {
            id: row ? String(row.id) : undefined,
            kind: String(v.kind) as "banner" | "announcement",
            title: String(v.title),
            body: String(v.body),
            image: String(v.image),
            link: String(v.link),
            audience: String(v.audience) as "all" | "members",
            priority: Number(v.priority),
            active: Boolean(v.active),
            startsAt: v.startsAt ? new Date(String(v.startsAt)).toISOString() : null,
            endsAt: v.endsAt ? new Date(String(v.endsAt)).toISOString() : null,
          },
        }),
      ),
  };
}
function ActionDialog({
  action,
  close,
  onSaved,
}: {
  action: Action | null;
  close: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | number | boolean | null>>(() =>
      Object.fromEntries(action?.fields.map((f) => [f.name, f.value ?? ""]) ?? []),
    ),
    [busy, setBusy] = useState(false),
    [output, setOutput] = useState<string | null>(null),
    [slipImage, setSlipImage] = useState("");
  return (
    <Dialog
      open={Boolean(action)}
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent title={action?.title ?? ""} className="max-h-[90dvh] overflow-auto">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!action || busy) return;
            setBusy(true);
            void action
              .run(values)
              .then((r) => {
                if (
                  r &&
                  typeof r === "object" &&
                  "slipImage" in r &&
                  typeof r.slipImage === "string"
                ) {
                  setSlipImage(r.slipImage);
                  setOutput("เปิดสลิปแล้ว ตรวจยอดและเลขอ้างอิงจากธนาคารก่อนอนุมัติ");
                } else setOutput(JSON.stringify(r, null, 2));
                toast.success("บันทึกแล้ว");
                onSaved();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ"))
              .finally(() => setBusy(false));
          }}
        >
          {action?.fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={`action-${f.name}`}>{f.label}</Label>
              {f.type === "checkbox" ? (
                <input
                  id={`action-${f.name}`}
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                />
              ) : f.type === "select" ? (
                <NativeSelect
                  id={`action-${f.name}`}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                >
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </NativeSelect>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={`action-${f.name}`}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`action-${f.name}`}
                  type={
                    f.type === "datetime"
                      ? "datetime-local"
                      : f.type === "number"
                        ? "number"
                        : "text"
                  }
                  value={String(values[f.name] ?? "")}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value,
                    }))
                  }
                />
              )}
              {f.name === "image" ? (
                <ImageEditor
                  kind={values.kind === "banner" ? "banner" : "announcement"}
                  value={String(values.image ?? "")}
                  onSaved={(url) => setValues((v) => ({ ...v, image: url }))}
                />
              ) : null}
            </div>
          ))}
          {slipImage ? (
            <img
              src={slipImage}
              alt="สลิปสำหรับตรวจสอบ"
              className="w-full rounded-xl object-contain"
            />
          ) : null}
          {output ? (
            <>
              <p className="text-sm">
                บันทึกสำเร็จ{" "}
                {action?.title === "สร้างโค้ดของขวัญ" ? "เก็บโค้ดนี้ไว้ จะแสดงครั้งเดียว" : ""}
              </p>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-3 text-xs">
                {output}
              </pre>
              <Button type="button" onClick={close}>
                ปิด
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">
                ตรวจสอบข้อมูลก่อนยืนยัน ระบบจะบันทึกประวัติการดำเนินการ
              </p>
              <Button disabled={busy} type="submit">
                {busy ? "กำลังบันทึก…" : "ยืนยัน"}
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function RealDashboard() {
  const [days, setDays] = useState(30),
    [data, setData] = useState<Awaited<ReturnType<typeof dashboardData>> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      void dashboardData({ data: { days } })
        .then((d) => {
          if (active) setData(d);
        })
        .catch(() => {
          if (active) setError("โหลดภาพรวมไม่สำเร็จ");
        });
    load();
    const unsubscribe = onShopChange(load);
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, [days]);
  const names: Record<string, string> = {
    members: "สมาชิก",
    new_members: "สมาชิกใหม่",
    products: "สินค้า",
    stock: "สต็อกพร้อมขาย",
    low_stock: "สินค้าใกล้หมด",
    orders: "ออเดอร์",
    sales: "ยอดขายสำเร็จ",
    topups: "เครดิตเติมเข้า",
    credit: "เครดิตรวม",
    waiting_delivery: "รอจัดส่ง",
    pending_claims: "เคลมค้าง",
  };
  return (
    <div className="space-y-5">
      <NativeSelect
        aria-label="ช่วงเวลา"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        {[
          [1, "วันนี้ (24 ชั่วโมง)"],
          [7, "7 วัน"],
          [30, "30 วัน"],
          [3650, "ทั้งหมด (10 ปี)"],
        ].map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
      {error ? <p>{error}</p> : null}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Object.entries(data?.totals ?? {}).map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface p-5 shadow-border">
            <p className="text-xs text-muted">{names[k] ?? k}</p>
            <p className="mt-2 text-xl font-semibold">{Number(v).toLocaleString("th-TH")}</p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl bg-surface p-5">
        <h2 className="font-medium">ยอดขายรายวัน</h2>
        {data?.chart.map((r) => (
          <div key={r.day} className="flex justify-between py-2 text-sm">
            <span>{r.day}</span>
            <span>{r.sales} บาท</span>
          </div>
        ))}
      </section>
      <section className="rounded-2xl bg-surface p-5">
        <h2 className="font-medium">ขายดี</h2>
        {data?.best.map((r) => (
          <p key={r.name} className="mt-2 text-sm">
            {r.name} · {r.quantity} ชิ้น
          </p>
        ))}
      </section>
      <section className="rounded-2xl bg-surface p-5">
        <h2 className="font-medium">สมาชิกถึงเกณฑ์ · ตรวจและอนุมัติในหน้าสมาชิก</h2>
        {data?.eligible.map((r) => (
          <p key={String(r.id)} className="mt-2 text-sm">
            {r.name} · {r.spending} บาท · {r.rank}
          </p>
        ))}
      </section>
    </div>
  );
}
export function RealSettings() {
  const [value, setValue] = useState<SiteConfiguration | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void getSiteConfiguration().then(setValue);
  }, []);
  if (!value) return <p>กำลังโหลด…</p>;
  const settingLabels: Record<string, string> = {
    name: "ชื่อร้าน",
    description: "คำอธิบายร้าน",
    logo: "โลโก้",
    favicon: "ไอคอนเว็บไซต์",
    primary: "สีหลัก",
    secondary: "สีรอง",
    discord: "Discord",
    facebook: "Facebook",
    terms: "เงื่อนไขเติมเงิน",
    refundText: "ขั้นตอนคืนเงิน",
    privacy: "นโยบายความเป็นส่วนตัว",
    maintenance: "ปิดปรับปรุง",
    lowStock: "เกณฑ์สินค้าใกล้หมด",
    vip: "ยอดซื้อ VIP",
    vvip: "ยอดซื้อ VVip",
    minimumTopup: "ยอดเติมขั้นต่ำ",
    maximumTopup: "ยอดเติมสูงสุด",
    slipFeeBps: "ค่าธรรมเนียมสลิป (290 = 2.9%)",
    google: "เปิด Google",
    trueMoney: "เปิด TrueMoney แบบตรวจด้วยมือ",
    slip2go: "เปิด Slip2Go",
    notificationRetentionDays: "เก็บการแจ้งเตือนที่อ่านแล้ว (วัน, 0 = ไม่ลบ)",
    loginRetentionDays: "เก็บประวัติเข้าสู่ระบบ (วัน, 0 = ไม่ลบ)",
    jobRetentionDays: "เก็บงานที่สำเร็จ (วัน, 0 = ไม่ลบ)",
    imageMaxMb: "ไฟล์รูปสูงสุด MB",
    imageQuality: "คุณภาพรูป 40–95",
    imageSquare: "ขนาดรูปสี่เหลี่ยม px",
    imageBannerWidth: "ความกว้างแบนเนอร์ px",
    imageBannerHeight: "ความสูงแบนเนอร์ px",
  };
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void saveSiteConfiguration({ data: value })
          .then((r) => {
            if (r.ok) toast.success("บันทึกการตั้งค่าแล้ว");
            else toast.error(r.message);
          })
          .catch(() => toast.error("บันทึกไม่สำเร็จ"))
          .finally(() => setBusy(false));
      }}
    >
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="space-y-1">
          <Label htmlFor={`setting-${k}`}>{settingLabels[k] ?? k}</Label>
          {typeof v === "boolean" ? (
            <input
              id={`setting-${k}`}
              type="checkbox"
              checked={v}
              onChange={(e) => setValue({ ...value, [k]: e.target.checked })}
            />
          ) : ["terms", "refundText", "privacy"].includes(k) ? (
            <Textarea
              id={`setting-${k}`}
              value={String(v)}
              onChange={(e) => setValue({ ...value, [k]: e.target.value })}
            />
          ) : (
            <Input
              id={`setting-${k}`}
              type={typeof v === "number" ? "number" : "text"}
              value={String(v)}
              onChange={(e) =>
                setValue({
                  ...value,
                  [k]: typeof v === "number" ? Number(e.target.value) : e.target.value,
                })
              }
            />
          )}{" "}
          {["logo", "favicon"].includes(k) ? (
            <ImageEditor
              kind={k as "logo" | "favicon"}
              value={String(v)}
              onSaved={(url) => setValue({ ...value, [k]: url })}
            />
          ) : null}
        </div>
      ))}
      <p className="text-xs text-muted sm:col-span-2">
        ข้อมูลลับตั้งค่าในบริการโฮสต์เท่านั้น เมื่อเปิดปิดปรับปรุงจะระงับการซื้อและเติมเงิน
      </p>
      <Button disabled={busy} type="submit">
        ยืนยันบันทึกการตั้งค่า
      </Button>
    </form>
  );
}
export function MediaLibrary() {
  const [assets, setAssets] = useState<Awaited<ReturnType<typeof listMedia>>>([]);
  const load = () => void listMedia().then(setAssets);
  useEffect(load, []);
  return (
    <div className="space-y-4">
      <ImageEditor kind="product" onSaved={load} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {assets.map((a) => (
          <div key={a.id} className="rounded-xl border p-3">
            <img
              src={`/api/media/${a.id}?variant=thumbnail`}
              alt={a.kind}
              className="h-32 w-full object-contain"
            />
            <p className="text-xs mt-2">
              {a.kind} · {a.width}×{a.height} · {Math.ceil(a.size / 1024)} KB
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(`/api/media/${a.id}`);
                toast.success("คัดลอกที่อยู่รูปแล้ว");
              }}
            >
              คัดลอกที่อยู่
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!window.confirm("ลบรูปที่ไม่ได้ใช้งานนี้?")) return;
                void deleteMedia({ data: { id: a.id } }).then((r) => {
                  if (!r.ok) toast.error(r.message);
                  else load();
                });
              }}
            >
              ลบ
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
export function SystemPanel() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof systemHealth>> | null>(null);
  const load = () => void systemHealth().then(setHealth);
  useEffect(load, []);
  return (
    <div className="space-y-4">
      <h2 className="font-medium">สถานะระบบ</h2>
      {Object.entries(health ?? {}).map(([k, v]) => (
        <p key={k} className="text-sm">
          {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
        </p>
      ))}
      <Button
        onClick={() =>
          void runJobs().then((r) => {
            toast.success(`ประมวลผล ${r.processed} งาน`);
            load();
          })
        }
      >
        ประมวลผลงานพร้อมทำ
      </Button>
      <p className="text-sm text-muted">
        การชำระเงินและ Google แสดงพร้อมตั้งค่าจนกว่าจะทดสอบกับผู้ให้บริการจริง
      </p>
    </div>
  );
}
export function BackupPanel() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof listBackups>>>([]),
    [busy, setBusy] = useState(false);
  const load = () => void listBackups().then(setRecords);
  useEffect(load, []);
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted">
        สำรองแบบเข้ารหัส ดาวน์โหลดเก็บนอกระบบ และทดสอบกู้คืนในฐานข้อมูลแยก
        การกู้คืนจริงไม่เขียนทับร้านที่กำลังใช้งาน
      </p>
      <Button
        disabled={busy}
        onClick={() => {
          if (!window.confirm("สร้างข้อมูลสำรองที่เข้ารหัส?")) return;
          setBusy(true);
          void backupNow()
            .then(() => {
              toast.success("สำรองแล้ว");
              load();
            })
            .catch(() => toast.error("สำรองไม่สำเร็จ โปรดตรวจค่ากุญแจสำรอง"))
            .finally(() => setBusy(false));
        }}
      >
        สำรองตอนนี้
      </Button>
      {records.map((r) => (
        <div key={r.id} className="rounded-xl border p-4 space-y-2">
          <p className="text-sm">
            {r.created_at} · {r.status} · {Math.ceil(r.size / 1024)} KB
          </p>
          <p className="break-all text-xs text-muted">{r.checksum}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void downloadBackup({ data: { id: r.id } })
                .then((result) => {
                  const binary = Uint8Array.from(atob(result.encoded), (c) => c.charCodeAt(0));
                  const url = URL.createObjectURL(
                    new Blob([binary], { type: "application/octet-stream" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `veltshop-${r.id}.backup`;
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => toast.error("ดาวน์โหลดไม่สำเร็จ"));
            }}
          >
            ดาวน์โหลดไฟล์เข้ารหัส
          </Button>
          <Button
            disabled={busy}
            variant="secondary"
            size="sm"
            onClick={() => {
              setBusy(true);
              void verifyBackup({ data: { id: r.id } })
                .then(() => {
                  toast.success("ทดสอบกู้คืนผ่านแล้ว");
                  load();
                })
                .catch(() => toast.error("ทดสอบกู้คืนไม่ผ่าน"))
                .finally(() => setBusy(false));
            }}
          >
            ทดสอบกู้คืนในฐานข้อมูลแยก
          </Button>
        </div>
      ))}
    </section>
  );
}
export function CampaignSettings() {
  const [value, setValue] = useState<{
    id: "wheel" | "box";
    title: string;
    cost: number;
    dailyLimit: number;
    active: boolean;
    prizes: { label: string; credit: number; weight: number }[];
  }>({
    id: "wheel",
    title: "กงล้อนำโชค",
    cost: 0,
    dailyLimit: 2,
    active: false,
    prizes: [
      { label: "ครั้งหน้าลุ้นใหม่", credit: 0, weight: 90 },
      { label: "เครดิตของขวัญ", credit: 5, weight: 10 },
    ],
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void saveRewardCampaign({ data: value })
          .then(() => toast.success("บันทึกกิจกรรมแล้ว"))
          .catch(() => toast.error("บันทึกไม่สำเร็จ"));
      }}
    >
      <Label htmlFor="campaign-kind">กิจกรรม</Label>
      <NativeSelect
        id="campaign-kind"
        value={value.id}
        onChange={(e) => {
          const id = e.target.value as "wheel" | "box";
          void getRewardCampaign({ data: { id } }).then((c) =>
            setValue(
              c ?? {
                ...value,
                id,
                title: id === "wheel" ? "กงล้อนำโชค" : "กล่องสุ่ม",
                active: false,
              },
            ),
          );
        }}
      >
        <option value="wheel">กงล้อ</option>
        <option value="box">กล่อง</option>
      </NativeSelect>
      <Label htmlFor="campaign-title">ชื่อกิจกรรม</Label>
      <Input
        id="campaign-title"
        value={value.title}
        onChange={(e) => setValue({ ...value, title: e.target.value })}
      />
      <Label htmlFor="campaign-cost">ค่าเข้าร่วม บาท</Label>
      <Input
        id="campaign-cost"
        type="number"
        min={0}
        max={10000}
        value={value.cost}
        onChange={(e) => setValue({ ...value, cost: Number(e.target.value) })}
      />
      <Label htmlFor="campaign-limit">สิทธิ์ต่อวัน</Label>
      <Input
        id="campaign-limit"
        type="number"
        min={1}
        max={100}
        value={value.dailyLimit}
        onChange={(e) => setValue({ ...value, dailyLimit: Number(e.target.value) })}
      />
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(e) => setValue({ ...value, active: e.target.checked })}
        />{" "}
        เปิดกิจกรรม
      </label>
      {value.prizes.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs">
            ชื่อรางวัล
            <Input
              value={p.label}
              onChange={(e) =>
                setValue({
                  ...value,
                  prizes: value.prizes.map((v, n) =>
                    n === i ? { ...v, label: e.target.value } : v,
                  ),
                })
              }
            />
          </label>
          <label className="text-xs">
            เครดิตรางวัล
            <Input
              type="number"
              min={0}
              max={10000}
              value={p.credit}
              onChange={(e) =>
                setValue({
                  ...value,
                  prizes: value.prizes.map((v, n) =>
                    n === i ? { ...v, credit: Number(e.target.value) } : v,
                  ),
                })
              }
            />
          </label>
          <label className="text-xs">
            น้ำหนักโอกาส
            <Input
              type="number"
              min={1}
              max={10000}
              value={p.weight}
              onChange={(e) =>
                setValue({
                  ...value,
                  prizes: value.prizes.map((v, n) =>
                    n === i ? { ...v, weight: Number(e.target.value) } : v,
                  ),
                })
              }
            />
          </label>
        </div>
      ))}
      <p className="text-xs text-muted">
        โอกาสคำนวณจากน้ำหนักรวม ลูกค้าจะเห็นราคาและโอกาสก่อนยืนยัน ผลสุ่มจากเซิร์ฟเวอร์เท่านั้น
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={value.prizes.length >= 20}
        onClick={() =>
          setValue({
            ...value,
            prizes: [...value.prizes, { label: "รางวัลใหม่", credit: 0, weight: 1 }],
          })
        }
      >
        เพิ่มรางวัล
      </Button>
      <Button type="submit">ยืนยันบันทึก</Button>
    </form>
  );
}
