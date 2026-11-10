"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { usePanier } from "@/lib/client/panier";
import { formatFCFA } from "@/lib/format";

/** Barre flottante « Voir mon panier », visible dès qu'un article est ajouté. */
export function BarrePanier() {
  const { nombreArticles, total } = usePanier();
  if (nombreArticles === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center">
      <div className="w-full max-w-[440px] px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        <Link
          href="/panier"
          className="pointer-events-auto flex h-[60px] items-center justify-between rounded-2xl bg-terracotta px-[18px] text-creme shadow-[0_12px_24px_-10px_rgba(163,72,31,.6)]"
        >
          <span className="flex items-center gap-2.5 text-base font-bold">
            <Icon name="bag" className="size-[22px]" />
            Voir mon panier
          </span>
          <span className="tabular text-base font-bold">
            {nombreArticles} · {formatFCFA(total)}
          </span>
        </Link>
      </div>
    </div>
  );
}
