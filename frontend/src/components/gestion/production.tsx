"use client";

import { useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Bouton, Carte, Encadre, Segments, cx } from "@/components/ui/primitives";
import { MOTIFS_INVENDU, PRODUCTION } from "@/lib/demo/gestion";

const COLONNES = "1.7fr .7fr .7fr .7fr .8fr .9fr .7fr 1.6fr";

type Ligne = (typeof PRODUCTION)[number];

const champ = "h-9 w-full rounded-lg border bg-papier px-2.5 outline-none focus:border-vert";

/** G4 · Production et invendus, déclarés en fin de service. */
export function Production() {
  const [service, setService] = useState<"dejeuner" | "diner">("diner");
  const [lignes, setLignes] = useState<Ligne[]>(PRODUCTION);
  const [enregistre, setEnregistre] = useState(false);

  const maj = (i: number, patch: Partial<Ligne>) => {
    setEnregistre(false);
    setLignes((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const manquants = lignes.filter((l) => l.restant === "");
  const prepare = lignes.reduce((s, l) => s + l.prepare, 0);
  const vendu = lignes.reduce((s, l) => s + (l.vendu ?? 0), 0);
  const declares = lignes.filter((l) => l.restant !== "");
  const restant = declares.reduce((s, l) => s + Number(l.restant || 0), 0);
  const reutilisable = declares.reduce((s, l) => s + Number(l.reutilisable || 0), 0);
  const prepareDeclares = declares.reduce((s, l) => s + l.prepare, 0);
  const taux = prepareDeclares ? ((restant / prepareDeclares) * 100).toFixed(1).replace(".", ",") : "0";

  const kpis = [
    { l: "Préparé", v: String(prepare), s: `portions · ${lignes.length} plats` },
    { l: "Vendu", v: String(vendu), s: "ventes validées" },
    { l: "Restant déclaré", v: String(restant), s: `dont ${reutilisable} réutilisables` },
    { l: "Taux d'invendus", v: `${taux} %`, s: "sur les plats déclarés" },
  ];

  return (
    <>
      <EntetePage
        titre="Production et invendus"
        sousTitre="Déclarer les quantités restantes, réutilisables et jetées, avec le motif."
        actions={
          <div className="flex items-center gap-2">
            <span className="flex h-11 items-center gap-2 rounded-xl bg-segment px-4 text-sm font-medium">
              <Icon name="calendar" className="size-4" />
              Dim. 8 nov.
            </span>
            <Segments
              valeur={service}
              onChange={setService}
              options={[
                { valeur: "dejeuner", libelle: "Déjeuner" },
                { valeur: "diner", libelle: "Dîner" },
              ]}
            />
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {kpis.map((k) => (
          <Carte key={k.l} className="flex flex-col gap-1 px-[18px] py-4">
            <span className="text-[13px] text-texte-2">{k.l}</span>
            <span className="tabular font-serif text-[28px] font-semibold text-vert">{k.v}</span>
            <span className="text-xs text-texte-3">{k.s}</span>
          </Carte>
        ))}
      </div>
      <Tableau
        colonnes={COLONNES}
        entetes={["PLAT", "PRÉVU", "PRÉPARÉ", "VENDU", "RESTANT", "RÉUTILISABLE", "JETÉ", "MOTIF"]}
        largeurMin={900}
      >
        {lignes.map((l, i) => {
          const manque = l.restant === "";
          return (
            <LigneTableau key={l.plat} colonnes={COLONNES} className="tabular py-2.5">
              <span className="font-bold">{l.plat}</span>
              <span className="text-texte-3">{l.prevu}</span>
              <span>{l.prepare}</span>
              <span>{l.vendu ?? "—"}</span>
              <input
                aria-label={`Restant ${l.plat}`}
                inputMode="numeric"
                value={l.restant}
                placeholder="À saisir"
                onChange={(e) => maj(i, { restant: e.target.value.replace(/\D/g, "") })}
                className={cx(
                  champ,
                  "border-[1.5px] font-bold",
                  manque ? "border-attention bg-attention-fond-2 text-attention placeholder:text-attention" : "border-vert",
                )}
              />
              <input
                aria-label={`Réutilisable ${l.plat}`}
                inputMode="numeric"
                value={l.reutilisable}
                onChange={(e) => maj(i, { reutilisable: e.target.value.replace(/\D/g, "") })}
                className={cx(champ, "border-bordure-2")}
              />
              <input
                aria-label={`Jeté ${l.plat}`}
                inputMode="numeric"
                value={l.jete}
                onChange={(e) => maj(i, { jete: e.target.value.replace(/\D/g, "") })}
                className={cx(champ, "border-bordure-2")}
              />
              <select
                aria-label={`Motif ${l.plat}`}
                value={l.motif}
                onChange={(e) => maj(i, { motif: e.target.value })}
                className={cx(champ, "cursor-pointer border-bordure-2 text-[13px]", manque && "text-attention")}
              >
                <option value="">{manque ? "À déclarer" : "—"}</option>
                {MOTIFS_INVENDU.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </LigneTableau>
          );
        })}
      </Tableau>
      <div className="mt-auto flex flex-wrap items-center gap-4">
        {manquants.length ? (
          <Encadre icone="alert" ton="attention" className="flex-1 text-sm">
            {manquants.map((m) => m.plat).join(", ")} non déclaré{manquants.length > 1 ? "s" : ""} : {manquants.length > 1 ? "ils ne sont pas comptés" : "il n'est pas compté"} comme « 0 invendu » et{" "}
            {manquants.length > 1 ? "restent exclus" : "reste exclu"} du taux d&apos;invendus.
          </Encadre>
        ) : (
          <Encadre icone="check" className="flex-1 text-sm">
            Tous les plats du service sont déclarés.
          </Encadre>
        )}
        <Bouton hauteur="lg" icone="check" className="h-[52px] px-[22px]" onClick={() => setEnregistre(true)}>
          {enregistre ? "Déclaration enregistrée" : "Enregistrer la déclaration"}
        </Bouton>
      </div>
    </>
  );
}
