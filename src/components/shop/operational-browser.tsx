import { useEffect, useId, useState, type ReactNode } from "react";
import { onShopChange } from "@/lib/shop/realtime-client";
import { listOperationalRecords } from "@/lib/shop/operational-records";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export type OperationalRow = Record<string, string | number | boolean | null>;
export function OperationalBrowser({
  kind,
  children,
  refresh = 0,
}: {
  kind: "media" | "backups" | "privacy";
  refresh?: number;
  children: (rows: OperationalRow[], reload: () => void) => ReactNode;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ rows: OperationalRow[]; total: number }>({
    rows: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void listOperationalRecords({
        data: {
          kind,
          search,
          status,
          page,
          descending,
          from: from ? new Date(`${from}T00:00:00+07:00`).toISOString() : null,
          to: to
            ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000).toISOString()
            : null,
        },
      })
        .then((value) => {
          if (active) setResult(value);
        })
        .catch(() => {
          if (active) setError("โหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [kind, search, status, page, descending, from, to, refresh, revision]);
  useEffect(() => onShopChange(() => setRevision((v) => v + 1)), []);
  const statuses =
    kind === "privacy"
      ? ["pending", "approved", "rejected"]
      : kind === "backups"
        ? ["created", "verified"]
        : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl bg-surface p-4 shadow-border sm:grid-cols-2 xl:grid-cols-5">
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-search`}>ค้นหารายการ</Label>
          <Input
            className="mt-2"
            id={`${id}-search`}
            value={search}
            maxLength={200}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={
              kind === "media" ? "รหัสรูป หรือประเภท" : "รหัสรายการ หรือข้อมูลที่เกี่ยวข้อง"
            }
          />
        </div>
        <div>
          <Label htmlFor={`${id}-sort`}>ลำดับ</Label>
          <NativeSelect
            className="mt-2"
            id={`${id}-sort`}
            value={String(descending)}
            onChange={(e) => {
              setDescending(e.target.value === "true");
              setPage(0);
            }}
          >
            <option value="true">ใหม่ไปเก่า</option>
            <option value="false">เก่าไปใหม่</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`${id}-from`}>ตั้งแต่</Label>
          <Input
            className="mt-2"
            id={`${id}-from`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-to`}>ถึง</Label>
          <Input
            className="mt-2"
            id={`${id}-to`}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {statuses.length ? (
          <div>
            <Label htmlFor={`${id}-status`}>สถานะ</Label>
            <NativeSelect
              className="mt-2"
              id={`${id}-status`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">ทั้งหมด</option>
              {statuses.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-danger">
          {error}
          <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : null}
      {loading ? (
        <p role="status" className="text-sm text-muted">
          กำลังโหลดรายการ…
        </p>
      ) : null}
      {children(result.rows, () => setRevision((v) => v + 1))}
      {!loading && !error && !result.rows.length ? (
        <p className="rounded-2xl bg-surface p-6 text-sm text-muted">ไม่พบรายการตามตัวกรอง</p>
      ) : null}
      <nav aria-label="หน้ารายการ" className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted" aria-live="polite">
          {result.total} รายการ · หน้า {page + 1} / {Math.max(1, Math.ceil(result.total / 24))}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={loading || page === 0}
            onClick={() => setPage((v) => v - 1)}
          >
            ก่อนหน้า
          </Button>
          <Button
            variant="secondary"
            disabled={loading || (page + 1) * 24 >= result.total}
            onClick={() => setPage((v) => v + 1)}
          >
            ถัดไป
          </Button>
        </div>
      </nav>
    </div>
  );
}
