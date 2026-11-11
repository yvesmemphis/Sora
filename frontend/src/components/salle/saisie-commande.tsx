"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, Puce, Quantite, cx } from "@/components/ui/primitives";
import { formatFCFA } from "@/lib/format";
import { DISPONIBILITES, MODES_PAIEMENT, MODES_SERVICE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import type { Categorie, ModePaiement, ModeService } from "@/lib/types";

/** S2 · Saisie d'une commande par le serveur. */
export function SaisieCommande() {
  const router = useRouter();
  const { creer, carte, emplacements } = useService();
  const PLATS = carte.plats;
  const CATEGORIES = carte.categories;
  const [choixCategorie, setCategorie] = useState<Categorie | null>(null);
  const categorie = choixCategorie ?? CATEGORIES[0] ?? "";
  const [recherche, setRecherche] = useState("");
  const [brouillon, setBrouillon] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<ModeService>("table");
  const [emplacement, setEmplacement] = useState("");
  const [paiement, setPaiement] = useState<ModePaiement>("especes");
  const [note, setNote] = useState("");
  const [differee, setDifferee] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const plats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return PLATS.filter((p) => (q ? p.nom.toLowerCase().includes(q) : p.categorie === categorie));
  }, [PLATS, categorie, recherche]);

  const lignes = Object.entries(brouillon)
    .filter(([, q]) => q > 0)
    .flatMap(([id, q]) => {
      const plat = PLATS.find((p) => p.id === id);
      return plat ? [{ plat, quantite: q }] : [];
    });
  const total = lignes.reduce((s, l) => s + l.plat.prix * l.quantite, 0);
  const requis = mode !== "emporter";
  const valide = lignes.length > 0 && (!requis || emplacement.trim() !== "");

  const regler = (id: string, q: number) => setBrouillon((b) => ({ ...b, [id]: Math.max(0, q) }));

  const references = emplacements
    .filter((e) => e.is_active && e.type === (mode === "chambre" ? "ROOM" : "TABLE"))
    .map((e) => (e.type === "TABLE" ? e.reference.replace(/^T/i, "") : e.reference));

  async function enregistrer() {
    if (!valide || envoi) return;
    setEnvoi(true);
    const cree = await creer({
      mode,
      emplacement: requis ? emplacement.trim() : "Au comptoir",
      paiement,
      lignes: lignes.map((l) => ({ platId: l.plat.id, quantite: l.quantite })),
      note: [note.trim(), differee ? "Saisie différée" : ""].filter(Boolean).join(" · ") || undefined,
    });
    setEnvoi(false);
    if (cree) router.push("/salle");
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_400px] lg:overflow-hidden">
      {/* Carte */}
      <section aria-label="Carte" className="flex min-h-0 flex-col gap-4 px-4 py-5 md:px-6 lg:overflow-y-auto">
        <label className="flex h-[52px] items-center gap-2.5 rounded-xl border border-ligne-2 bg-papier px-4 text-texte-3 focus-within:border-vert">
          <Icon name="search" className="size-5" />
          <span className="sr-only">Rechercher un plat</span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un plat"
            className="h-full flex-1 bg-transparent text-base text-encre outline-none placeholder:text-texte-3"
          />
        </label>
        {!recherche ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <Puce key={c} actif={c === categorie} onClick={() => setCategorie(c)} taille="lg">
                {c}
              </Puce>
            ))}
          </div>
        ) : null}
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {plats.map((p) => {
            const q = brouillon[p.id] ?? 0;
            const ok = p.disponibilite === "disponible";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!ok}
                  onClick={() => regler(p.id, q + 1)}
                  className={cx(
                    "flex min-h-[132px] w-full cursor-pointer flex-col gap-2 rounded-2xl bg-papier p-3.5 text-left disabled:cursor-not-allowed",
                    q ? "border-2 border-vert" : "border border-ligne",
                    !ok && "opacity-70",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-base leading-5 font-bold">{p.nom}</span>
                    {q ? (
                      <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-vert text-sm font-bold text-creme">
                        {q}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-texte-3">
                    <Icon name="clock" className="size-3.5" />
                    {p.preparationMin ? `${p.preparationMin} min` : "—"}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-1.5">
                    <span className="tabular text-[15px] font-bold text-vert">{formatFCFA(p.prix)}</span>
                    <Badge apparence={DISPONIBILITES[p.disponibilite]} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Brouillon */}
      <section
        aria-label="Nouvelle commande"
        className="flex min-h-0 flex-col gap-4 border-ligne-2 bg-papier p-5 lg:overflow-y-auto lg:border-l"
      >
        <div className="flex items-baseline justify-between">
          <h1 className="m-0 font-serif text-2xl font-semibold text-vert">Nouvelle commande</h1>
          <span className="text-[13px] text-texte-3">brouillon</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(MODES_SERVICE) as ModeService[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === mode}
              onClick={() => setMode(m)}
              className={cx(
                "flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-bold",
                m === mode ? "bg-vert text-creme" : "border border-bordure text-vert",
              )}
            >
              <Icon name={MODES_SERVICE[m].icone} className="size-5" />
              {MODES_SERVICE[m].libelle}
            </button>
          ))}
        </div>
        {requis ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">{MODES_SERVICE[mode].champ}</span>
            <input
              value={emplacement}
              onChange={(e) => setEmplacement(e.target.value)}
              inputMode="numeric"
              list="emplacements-connus"
              placeholder={mode === "table" ? "Ex. 6" : "Ex. 204"}
              className="h-[52px] rounded-xl border-[1.5px] border-vert px-3.5 text-lg font-bold outline-none"
            />
            <datalist id="emplacements-connus">
              {references.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
        ) : null}

        <div className="flex min-h-[120px] flex-1 flex-col gap-2.5">
          {lignes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-bordure p-4 text-center text-sm text-texte-3">
              Touchez un plat pour l&apos;ajouter.
            </p>
          ) : (
            lignes.map((l) => (
              <div key={l.plat.id} className="flex items-center gap-2.5 border-b border-ligne-3 pb-2.5">
                <div className="flex flex-1 flex-col">
                  <span className="text-[15px] font-bold">{l.plat.nom}</span>
                  <span className="text-[13px] text-texte-3">{formatFCFA(l.plat.prix)}</span>
                </div>
                <Quantite valeur={l.quantite} onChange={(q) => regler(l.plat.id, q)} />
              </div>
            ))
          )}
          <label className="flex items-center gap-2 rounded-[10px] bg-sable px-3 py-2.5 text-sm text-texte-2">
            <Icon name="note" className="size-4 text-attention" />
            <span className="sr-only">Instructions pour la cuisine</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Instructions : bien cuit…"
              className="flex-1 bg-transparent outline-none placeholder:text-texte-3"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(MODES_PAIEMENT) as ModePaiement[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === paiement}
              onClick={() => setPaiement(p)}
              className={cx(
                "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl text-[15px] text-vert",
                p === paiement ? "border-2 border-vert font-bold" : "border border-bordure font-medium",
              )}
            >
              <Icon name={MODES_PAIEMENT[p].icone} className="size-5" />
              {MODES_PAIEMENT[p].libelle}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-texte-2">
          <input
            type="checkbox"
            checked={differee}
            onChange={(e) => setDifferee(e.target.checked)}
            className="size-[22px] accent-vert"
          />
          Saisie différée (commande prise plus tôt)
        </label>
        <Bouton hauteur="xl" onClick={enregistrer} disabled={!valide || envoi}>
          Enregistrer · {formatFCFA(total)}
        </Bouton>
      </section>
    </div>
  );
}
