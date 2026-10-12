import { Copy } from "lucide-react";
import { toast } from "sonner";

export function AccountId({ value, label = "รหัสบัญชี" }: { value: string; label?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 break-all font-mono text-xs text-muted">
        {label}: {value}
      </span>
      <button
        type="button"
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg hover:bg-surface-2"
        aria-label={`คัดลอก${label}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => toast.success("คัดลอกรหัสแล้ว"))
            .catch(() => toast.error("คัดลอกไม่ได้ กรุณาเลือกรหัสเพื่อคัดลอก"));
        }}
      >
        <Copy className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
