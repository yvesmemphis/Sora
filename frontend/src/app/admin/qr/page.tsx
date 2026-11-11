import type { Metadata } from "next";
import { QrEmplacements } from "@/components/admin/qr-emplacements";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "QR et emplacements" };

export default function PageQr() {
  return <QrEmplacements />;
}
