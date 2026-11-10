import type { Metadata } from "next";
import { QrEmplacements } from "@/components/admin/qr-emplacements";

export const metadata: Metadata = { title: "QR et emplacements" };

export default function PageQr() {
  return <QrEmplacements />;
}
