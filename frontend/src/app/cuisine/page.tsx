import { TableauCuisine } from "@/components/cuisine/tableau-cuisine";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export default function PageCuisine() {
  return <TableauCuisine />;
}
