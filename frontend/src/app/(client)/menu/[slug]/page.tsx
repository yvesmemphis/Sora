import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichePlat } from "@/components/client/fiche-plat";
import { PLATS, trouverPlat } from "@/lib/demo/menu";

export function generateStaticParams() {
  return PLATS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/menu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: trouverPlat(slug)?.nom ?? "Plat" };
}

export default async function PagePlat({ params }: PageProps<"/menu/[slug]">) {
  const { slug } = await params;
  const plat = trouverPlat(slug);
  if (!plat) notFound();
  return <FichePlat plat={plat} />;
}
