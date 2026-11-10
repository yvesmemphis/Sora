import type { Metadata } from "next";
import { Stocks } from "@/components/gestion/stocks";

export const metadata: Metadata = { title: "Stocks" };

export default function PageStocks() {
  return <Stocks />;
}
