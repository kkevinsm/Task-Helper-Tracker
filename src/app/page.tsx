import Link from "next/link";
import { ChevronRight, PackageSearch } from "lucide-react";
import { Logo } from "@/components/logo";
import { TrackForm } from "@/components/track-form";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-matcha-600 transition hover:text-berry-600"
        >
          Admin <ChevronRight className="size-3.5" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-5 pt-10 pb-16">
        <div className="relative mb-6">
          <div className="grid size-20 place-items-center rounded-full bg-linear-to-br from-berry-100 to-matcha-100 shadow-inner">
            <PackageSearch className="size-9 text-berry-600" strokeWidth={1.6} />
          </div>
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full border-2 border-cream bg-matcha-400" />
        </div>

        <h1 className="text-center font-serif text-5xl leading-tight font-semibold text-matcha-800">
          Cek Status
          <br />
          <span className="text-berry-500 italic">Pesananmu</span>
        </h1>
        <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-matcha-600">
          Masukkan kode antrean yang kamu terima untuk melihat status terkini
          pengerjaan tugasmu.
        </p>

        <TrackForm />
      </main>

      <footer className="py-6 text-center text-xs text-matcha-500">
        © 2026 urtaskhelper · dibuat dengan 🍵 &amp; 🍓
      </footer>
    </div>
  );
}
