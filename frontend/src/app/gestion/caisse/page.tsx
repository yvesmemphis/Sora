import type { Metadata } from "next";
import { ClotureCaisse } from "@/components/gestion/cloture-caisse";

export const metadata: Metadata = { title: "Clôture de caisse" };

export default function PageCaisse() {
  return <ClotureCaisse />;
}
