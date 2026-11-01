import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-linear-to-br from-berry-400 to-matcha-400 text-white shadow-sm transition group-hover:rotate-6">
        <Sparkles className="size-4" />
      </span>
      <span className="font-serif text-xl font-semibold text-matcha-800 italic">
        urtask<span className="text-berry-500">helper</span>
      </span>
    </Link>
  );
}

