/**
 * Formats d'affichage imposés par la charte :
 * prix « 6 500 FCFA », heures « 19 h 30 ».
 */

/** Sépare les milliers par une espace simple : 1245000 → « 1 245 000 ». */
export function formatNombre(n: number): string {
  return Math.round(n)
    .toLocaleString("fr-FR")
    .replace(/[  ]/g, " ");
}

/** 6500 → « 6 500 FCFA ». */
export function formatFCFA(n: number): string {
  return `${formatNombre(n)} FCFA`;
}

/** Écart signé : 2500 → « +2 500 FCFA », -2500 → « −2 500 FCFA ». */
export function formatEcart(n: number): string {
  const signe = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${signe}${formatFCFA(Math.abs(n))}`;
}

/** Date → « 19 h 30 ». */
export function formatHeure(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h} h ${m}`;
}

/** Secondes → « 04:12 ». */
export function formatMinuteur(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** « Mariam Diallo » → « MD ». */
export function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** Convertit une saisie libre (« 410 000 ») en nombre. */
export function lireMontant(saisie: string): number {
  return parseInt(saisie.replace(/\D/g, "") || "0", 10);
}
