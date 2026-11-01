import Link from "next/link";
import { Sparkles } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Admin Login — urtaskhelper" };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-berry-400 to-matcha-400 text-white shadow-lg shadow-berry-200">
        <Sparkles className="size-6" />
      </div>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-matcha-800 italic">
        urtask<span className="text-berry-500">helper</span>
      </h1>
      <p className="mt-1 text-xs text-matcha-500">Admin Panel · Masuk untuk lanjut</p>

      <LoginForm />

      <Link
        href="/"
        className="mt-6 text-xs text-berry-500 underline underline-offset-4 hover:text-berry-700"
      >
        ← Kembali ke halaman cek status
      </Link>
    </main>
  );
}

