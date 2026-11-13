"use client";

import { useCallback, useEffect, useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Bouton, Carte, classeChamp, cx } from "@/components/ui/primitives";
import { messageErreur, telechargerBlob } from "@/lib/api/client";
import { referenceAffichee, referenceSaisie, type TypeEmplacement } from "@/lib/api/conversions";
import { activerEmplacement, chargerQrMenu, creerEmplacement, listerEmplacements, type EmplacementApi } from "@/lib/api/emplacements";

/** Libellé d'un QR : comptoir (sans emplacement), table ou chambre. */
function nomQr(e?: EmplacementApi): string {
  if (!e) return "Menu · à emporter (comptoir)";
  return e.type === "TABLE" ? `Table ${referenceAffichee(e.type, e.reference)}` : `Chambre ${e.reference}`;
}

/** Aperçu du QR généré par l'API (`GET /public/menu/qr/`), téléchargeable et imprimable. */
function ApercuQr({ emplacement, onErreur }: { emplacement?: EmplacementApi; onErreur: (m: string) => void }) {
  const [qr, setQr] = useState<{ url: string; blob: Blob; cible: string | null } | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    let url: string | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement depuis l'API
    setChargement(true);
    chargerQrMenu(emplacement)
      .then(({ blob, cible }) => {
        if (!actif) return;
        url = URL.createObjectURL(blob);
        setQr({ url, blob, cible });
      })
      .catch((e: unknown) => actif && onErreur(messageErreur(e)))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [emplacement, onErreur]);

  const nom = nomQr(emplacement);
  const fichier = `qr-${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.png`;

  function imprimer() {
    if (!qr) return;
    const fenetre = window.open("", "_blank", "width=480,height=600");
    if (!fenetre) return;
    const doc = fenetre.document;
    doc.title = nom;
    const titre = doc.createElement("h1");
    titre.textContent = nom;
    titre.style.cssText = "font-family:sans-serif;text-align:center";
    const img = doc.createElement("img");
    img.src = qr.url;
    img.style.cssText = "display:block;margin:0 auto;width:320px;height:320px";
    img.onload = () => fenetre.print();
    doc.body.append(titre, img);
  }

  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-4 border-t border-ligne-3 py-3 text-sm">
      <span className="flex size-[120px] items-center justify-center overflow-hidden rounded-lg border border-bordure-2 bg-white">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- image générée à la volée (blob)
          <img src={qr.url} alt={`QR code · ${nom}`} className="size-full" />
        ) : (
          <span className="text-xs text-texte-3">{chargement ? "Génération…" : "Indisponible"}</span>
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-bold">{nom}</span>
        {qr?.cible ? <span className="truncate font-mono text-xs text-texte-3" title={qr.cible}>{qr.cible}</span> : null}
        <div className="flex flex-wrap gap-1.5">
          <Bouton variante="contour" hauteur="sm" icone="printer" disabled={!qr} onClick={imprimer}>
            Imprimer
          </Bouton>
          <Bouton variante="contour" hauteur="sm" disabled={!qr} onClick={() => qr && telechargerBlob(qr.blob, fichier)}>
            Télécharger
          </Bouton>
          {qr?.cible ? (
            <Bouton variante="fantome" hauteur="sm" onClick={() => void navigator.clipboard?.writeText(qr.cible ?? "")}>
              Copier le lien
            </Bouton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A2 · QR codes du menu et emplacements. */
export function QrEmplacements() {
  const [qrChoisi, setQrChoisi] = useState<string>("");
  const [emplacements, setEmplacements] = useState<EmplacementApi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toutesChambres, setToutesChambres] = useState(false);
  const [ajout, setAjout] = useState<{ type: TypeEmplacement; reference: string }>({ type: "TABLE", reference: "" });

  const signalerErreur = useCallback((m: string) => setErreur(m), []);

  const charger = useCallback(async () => {
    try {
      setEmplacements(await listerEmplacements());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement depuis l'API
    void charger();
  }, [charger]);

  const tables = emplacements
    .filter((e) => e.type === "TABLE")
    .sort((a, b) => a.reference.localeCompare(b.reference, "fr", { numeric: true }));
  const toutes = emplacements
    .filter((e) => e.type === "ROOM")
    .sort((a, b) => a.reference.localeCompare(b.reference, "fr", { numeric: true }));
  const chambres = toutesChambres ? toutes : toutes.slice(0, 16);

  async function basculer(e: EmplacementApi) {
    try {
      const maj = await activerEmplacement(e.id, !e.is_active);
      setEmplacements((prev) => prev.map((x) => (x.id === e.id ? maj : x)));
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  async function ajouter() {
    if (!ajout.reference.trim()) return;
    try {
      const cree = await creerEmplacement(ajout.type, referenceSaisie(ajout.type, ajout.reference));
      setEmplacements((prev) => [...prev, cree]);
      setAjout((a) => ({ ...a, reference: "" }));
      setErreur(null);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  /** Lien à encoder dans le QR d'un emplacement : il pré-remplit le panier du client. */
  const lienQr = (e: EmplacementApi) =>
    `${window.location.origin}/menu?${e.type === "TABLE" ? "table" : "chambre"}=${encodeURIComponent(e.reference)}`;

  const actifs = [...tables, ...toutes].filter((e) => e.is_active);
  const emplacementQr = actifs.find((e) => e.id === qrChoisi);

  return (
    <>
      <EntetePage
        titre="QR codes et emplacements"
        sousTitre="Le QR ouvre le menu. Un QR d'emplacement pré-remplit la table ou la chambre."
      />
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      <Carte className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[17px] font-bold">QR codes du menu</h2>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="font-medium">QR d&apos;emplacement</span>
            <select
              value={emplacementQr ? qrChoisi : ""}
              onChange={(ev) => setQrChoisi(ev.target.value)}
              className={cx(classeChamp, "h-10 cursor-pointer")}
            >
              <option value="">Choisir une table ou une chambre…</option>
              {actifs.map((e) => (
                <option key={e.id} value={e.id}>
                  {nomQr(e)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ApercuQr onErreur={signalerErreur} />
        {emplacementQr ? <ApercuQr key={emplacementQr.id} emplacement={emplacementQr} onErreur={signalerErreur} /> : null}
      </Carte>

      <Carte className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[17px] font-bold">Emplacements</h2>
          <span className="text-[13px] text-texte-3">Utilisés seulement pour renseigner la destination d&apos;une commande</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <Icon name="table" className="size-[18px] text-vert" />
            Tables · {tables.length}
            <span className="font-normal text-texte-3">(touchez pour activer ou désactiver, clic droit pour copier le lien du QR)</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.is_active}
                onClick={() => void basculer(t)}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  void navigator.clipboard?.writeText(lienQr(t));
                }}
                title={lienQr(t)}
                className={cx(
                  "flex h-9 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-bordure px-2.5 text-[13px] font-bold",
                  t.is_active ? "bg-papier text-encre" : "bg-ligne-3 text-texte-4 line-through",
                )}
              >
                {referenceAffichee(t.type, t.reference)}
              </button>
            ))}
            {!chargement && tables.length === 0 ? <span className="text-[13px] text-texte-3">Aucune table.</span> : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <Icon name="bed" className="size-[18px] text-vert" />
            Chambres · {toutes.length}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {chambres.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.is_active}
                onClick={() => void basculer(c)}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  void navigator.clipboard?.writeText(lienQr(c));
                }}
                title={lienQr(c)}
                className={cx(
                  "tabular flex h-9 min-w-[52px] cursor-pointer items-center justify-center rounded-lg border border-bordure px-2.5 text-[13px] font-bold",
                  c.is_active ? "bg-papier text-encre" : "bg-ligne-3 text-texte-4 line-through",
                )}
              >
                {c.reference}
              </button>
            ))}
            {toutes.length > 16 ? (
              <button
                type="button"
                onClick={() => setToutesChambres((v) => !v)}
                className="flex h-9 cursor-pointer items-center rounded-lg px-3 text-[13px] text-texte-3 hover:text-vert"
              >
                {toutesChambres ? "Réduire" : `+ ${toutes.length - 16} autres`}
              </button>
            ) : null}
            {!chargement && toutes.length === 0 ? <span className="text-[13px] text-texte-3">Aucune chambre.</span> : null}
          </div>
        </div>
        <form
          className="flex flex-wrap items-end gap-2 border-t border-ligne-3 pt-3.5"
          onSubmit={(ev) => {
            ev.preventDefault();
            void ajouter();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Type</span>
            <select
              value={ajout.type}
              onChange={(ev) => setAjout((a) => ({ ...a, type: ev.target.value as TypeEmplacement }))}
              className={cx(classeChamp, "h-10 cursor-pointer")}
            >
              <option value="TABLE">Table</option>
              <option value="ROOM">Chambre</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Numéro</span>
            <input
              value={ajout.reference}
              onChange={(ev) => setAjout((a) => ({ ...a, reference: ev.target.value.slice(0, 30) }))}
              placeholder={ajout.type === "TABLE" ? "15" : "413"}
              className={cx(classeChamp, "h-10 w-32")}
            />
          </label>
          <Bouton type="submit" variante="contour" hauteur="sm" icone="plus" disabled={!ajout.reference.trim()}>
            Ajouter
          </Bouton>
        </form>
      </Carte>
    </>
  );
}
