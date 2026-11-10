import type { Metadata } from "next";
import { Production } from "@/components/gestion/production";

export const metadata: Metadata = { title: "Production et invendus" };

export default function PageProduction() {
  return <Production />;
}
