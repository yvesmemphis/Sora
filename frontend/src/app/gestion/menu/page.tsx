import type { Metadata } from "next";
import { MenuRecettes } from "@/components/gestion/menu-recettes";

export const metadata: Metadata = { title: "Menu et recettes" };

export default function PageMenuRecettes() {
  return <MenuRecettes />;
}
