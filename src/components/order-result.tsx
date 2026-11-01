import {
  CalendarClock,
  CalendarPlus,
  Check,
  Download,
  ExternalLink,
  FileText,
  Info,
  MessageCircle,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import type { PublicOrder } from "@/lib/types";
import { STATUS_META, cn, formatDate, formatShortDate, whatsappLink } from "@/lib/utils";

const STEPS = [
  { key: "pending", label: "Diterima" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "completed", label: "Selesai" },
] as const;

export function OrderResult({ order }: { order: PublicOrder }) {
  const meta = STATUS_META[order.status];
  const cancelled = order.status === "cancelled";
  const activeIndex = cancelled ? -1 : STEPS.findIndex((s) => s.key === order.status);
  const stepDates = [order.created_at, order.started_at, order.completed_at];

  const wa = whatsappLink(
    `Halo kak, saya mau tanya progres tugas dengan kode antrean ${order.tracking_code} (${order.title}). Terima kasih 🙏`,
  );

  return (
    <div className="card overflow-hidden">
      <div className="h-1.5 bg-linear-to-r from-berry-300 via-berry-200 to-matcha-300" />
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rounded-md bg-matcha-50 px-2 py-0.5 font-mono text-xs font-semibold text-matcha-700 ring-1 ring-matcha-200">
              {order.tracking_code}
            </span>
            <h2 className="mt-3 font-serif text-2xl leading-snug font-semibold text-matcha-900">
              {order.title}
            </h2>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
              meta.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        </div>

        {/* Stepper */}
        {cancelled ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600 ring-1 ring-stone-200">
            <XCircle className="size-5 shrink-0 text-stone-400" />
            Pesanan ini telah dibatalkan. Hubungi admin jika ada pertanyaan.
          </div>
        ) : (
          <ol className="mt-7 grid grid-cols-3">
            {STEPS.map((step, i) => {
              const done = i <= activeIndex;
              const current = i === activeIndex;
              return (
                <li key={step.key} className="relative flex flex-col items-center text-center">
                  {i > 0 && (
                    <span
                      className={cn(
                        "absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2",
                        i <= activeIndex ? "bg-berry-300" : "bg-matcha-100",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid size-8 place-items-center rounded-full border-2 transition",
                      done
                        ? "border-berry-400 bg-berry-400 text-white"
                        : "border-matcha-200 bg-white text-matcha-300",
                      current && order.status !== "completed" && "ring-4 ring-berry-100",
                      current && order.status === "completed" && "border-matcha-500 bg-matcha-500 ring-4 ring-matcha-100",
                    )}
                  >
                    {done ? <Check className="size-4" strokeWidth={3} /> : <span className="text-xs font-semibold">{i + 1}</span>}
                  </span>
                  <span className={cn("mt-2 text-xs font-medium", done ? "text-matcha-800" : "text-matcha-400")}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-matcha-400">
                    {done && stepDates[i] ? formatShortDate(stepDates[i]) : "\u00a0"}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Details */}
        <dl className="mt-6 divide-y divide-matcha-100 rounded-2xl bg-matcha-50/60 px-4 ring-1 ring-matcha-100">
          <Row icon={User} label="Pemesan" value={order.client_name} />
          <Row icon={Tag} label="Kategori" value={order.category} />
          <Row icon={CalendarPlus} label="Tanggal Masuk" value={formatDate(order.created_at)} />
          <Row icon={CalendarClock} label="Deadline" value={formatDate(order.deadline)} />
        </dl>

        {order.notes && (
          <div className="mt-4 flex gap-2.5 rounded-2xl bg-berry-50/70 p-4 text-sm text-berry-800 ring-1 ring-berry-100">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p className="whitespace-pre-line">{order.notes}</p>
          </div>
        )}

        {/* Result files */}
        {order.status === "completed" && (order.has_file || order.result_link) && (
          <div className="mt-5 rounded-2xl border border-matcha-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-matcha-800">
              <FileText className="size-4 text-matcha-600" /> Hasil Pengerjaan
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {order.has_file && (
                <a
                  href={`/api/download/${encodeURIComponent(order.tracking_code)}`}
                  className="btn-matcha flex-1"
                >
                  <Download className="size-4" />
                  <span className="truncate">Unduh {order.result_file_name ?? "File"}</span>
                </a>
              )}
              {order.result_link && (
                <a
                  href={order.result_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost flex-1"
                >
                  <ExternalLink className="size-4" /> Buka Link Hasil
                </a>
              )}
            </div>
          </div>
        )}

        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="btn mt-5 w-full bg-[#25D366] text-white shadow-md shadow-green-200 hover:bg-[#1ebe5a]"
          >
            <MessageCircle className="size-4" /> Hubungi Admin via WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="flex items-center gap-2 text-matcha-600">
        <Icon className="size-4 text-matcha-400" />
        {label}
      </dt>
      <dd className="text-right font-medium text-matcha-900">{value}</dd>
    </div>
  );
}

