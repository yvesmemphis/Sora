import type { Metadata } from "next";
import { CarteRestaurant } from "@/components/client/carte-restaurant";

export const metadata: Metadata = { title: "La carte" };

export default function PageMenu() {
  return <CarteRestaurant />;
}
