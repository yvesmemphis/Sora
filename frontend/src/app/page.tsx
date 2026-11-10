import Link from "next/link";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, LogoMark } from "@/components/ui/primitives";
import { STATUTS_COMMANDE } from "@/lib/statuts";
import type { StatutCommande } from "@/lib/types";

const ESPACES: {
  num: string;
  titre: string;
  href: string;
  icone: NomIcone;
  fond: string;
  appareil: string;
  description: string;
  ecrans: string[];
}[] = [
  {
    num: "01",
    titre: "Client",
    href: "/menu",
    icone: "bag",
    fond: "bg-terracotta-fond text-terracotta",
    appareil: "Smartphone, sans compte",
    description:
      "Consulte la carte via QR code, commande, choisit son emplacement et son paiement, suit sa commande et peut se désister pendant 5 minutes.",
    ecrans: ["Carte", "Fiche plat", "Panier", "Suivi"],
  },
  {
    num: "02",
    titre: "Serveur / salle",
    href: "/salle",
    icone: "table",
    fond: "bg-servi-fond text-vert",
    appareil: "Tablette",
    description:
      "Suit le service, saisit une commande, renseigne la table ou la chambre, marque payé et traite les annulations après validation.",
    ecrans: ["Commandes du service", "Saisie", "Annulation"],
  },
  {
    num: "03",
    titre: "Cuisine",
    href: "/cuisine",
    icone: "flame",
    fond: "bg-nuit text-or",
    appareil: "Écran fixe ou tablette, fond sombre",
    description:
      "Voit les commandes confirmées, lance la préparation, marque prête, signale un retard ou une indisponibilité.",
    ecrans: ["Tableau en 3 colonnes", "Indisponibilité", "Ticket de secours"],
  },
  {
    num: "04",
    titre: "Gestionnaire",
    href: "/gestion",
    icone: "grid",
    fond: "bg-servi-fond text-vert",
    appareil: "Ordinateur ou tablette",
    description:
      "Pilote ventes, menu et recettes, stocks par lots, production et invendus, prévisions IA à valider et clôture de caisse.",
    ecrans: ["Tableau de bord", "Menu et recettes", "Stocks", "Production", "Prévisions IA", "Clôture de caisse"],
  },
  {
    num: "05",
    titre: "Administrateur",
    href: "/admin",
    icone: "shield",
    fond: "bg-attention-fond-2 text-attention",
    appareil: "Ordinateur",
    description:
      "Gère utilisateurs, rôles et permissions, QR codes et emplacements, paramètres de service et journal d'activité.",
    ecrans: ["Utilisateurs et rôles", "QR et emplacements", "Paramètres", "Journal"],
  },
];

const COULEURS = [
  ["Vert profond", "#1F3D36"],
  ["Terracotta", "#A3481F"],
  ["Crème", "#F6F0E6"],
  ["Or sourd", "#C99A3B"],
  ["Encre", "#22201C"],
  ["Nuit verte", "#14231F"],
];

const STATUTS: StatutCommande[] = ["recue", "confirmee", "preparation", "prete", "servie", "annulee", "refusee"];

export default function Accueil() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-col gap-10 bg-vert px-[clamp(16px,6vw,88px)] pt-14 pb-16 text-creme">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <LogoMark size={40} clair />
            <div className="flex flex-col">
              <span className="font-serif text-[26px] leading-none font-semibold">Maison Sora</span>
              <span className="mt-1.5 text-[11px] tracking-[.3em] text-or">HÔTEL · TABLE</span>
            </div>
          </div>
          <Link
            href="/connexion"
            className="flex items-center gap-2 rounded-xl border border-creme/30 px-4 py-2.5 text-sm font-bold hover:bg-creme/10"
          >
            <Icon name="user" className="size-[18px]" />
            Connexion du personnel
          </Link>
        </div>
        <div className="flex max-w-[820px] flex-col gap-4">
          <h1 className="m-0 font-serif text-[clamp(40px,5vw,64px)] leading-[1.05] font-semibold">
            De la carte à la table, sans détour.
          </h1>
          <p className="m-0 text-lg leading-relaxed text-pretty text-[#D9E0DB]">
            Plateforme de gestion du restaurant (MVP v1.2), vue par chacun des cinq intervenants. Un socle commun : un
            logo, deux polices, un jeu d&apos;icônes et des statuts identiques partout.
          </p>
        </div>
      </header>

      <main className="flex w-full max-w-[1440px] flex-col gap-14 px-[clamp(16px,6vw,88px)] pt-12 pb-20">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-5">
          {ESPACES.map((e) => (
            <Link
              key={e.num}
              href={e.href}
              className="flex flex-col gap-4 rounded-[20px] border border-ligne bg-papier p-6 text-encre no-underline transition-shadow hover:border-vert hover:shadow-[0_18px_36px_-24px_rgba(31,61,54,.5)]"
            >
              <div className="flex items-center justify-between">
                <span className={`flex size-[52px] items-center justify-center rounded-[14px] ${e.fond}`}>
                  <Icon name={e.icone} className="size-[26px]" />
                </span>
                <span className="text-[13px] font-bold tracking-[.12em] text-terracotta">{e.num}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-serif text-[26px] font-semibold text-vert">{e.titre}</span>
                <span className="text-[15px] leading-[22px] text-texte-2">{e.description}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {e.ecrans.map((s) => (
                  <span key={s} className="rounded-full bg-sable px-2.5 py-[5px] text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-ligne-3 pt-3.5 text-sm">
                <span className="text-texte-3">{e.appareil}</span>
                <span className="flex items-center gap-1.5 font-bold text-vert">
                  Ouvrir
                  <Icon name="arrow" className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <section className="flex flex-col gap-5">
          <span className="text-[13px] font-bold tracking-[.16em] text-terracotta">SOCLE COMMUN</span>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
            <div className="flex flex-col gap-3.5 rounded-[20px] border border-ligne bg-papier p-[22px]">
              <span className="text-[15px] font-bold">Couleurs</span>
              <div className="grid grid-cols-3 gap-2">
                {COULEURS.map(([nom, hex]) => (
                  <div key={hex} className="flex flex-col gap-1.5">
                    <span className="h-14 rounded-[10px] border border-black/5" style={{ background: hex }} />
                    <span className="text-xs font-bold">{nom}</span>
                    <span className="font-mono text-[11px] text-texte-3">{hex}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3.5 rounded-[20px] border border-ligne bg-papier p-[22px]">
              <span className="text-[15px] font-bold">Typographie</span>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[40px] leading-[1.1] font-semibold text-vert">Menu du jour</span>
                <span className="text-xs text-texte-3">Fraunces 600 · titres et chiffres clés</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[28px] leading-[1.2] font-bold">Commander · 6 500 FCFA</span>
                <span className="text-xs text-texte-3">DM Sans 400 / 500 / 700 · texte et interface</span>
              </div>
            </div>
            <div className="flex flex-col gap-3.5 rounded-[20px] border border-ligne bg-papier p-[22px]">
              <span className="text-[15px] font-bold">Statuts de commande</span>
              <div className="flex flex-wrap gap-2">
                {STATUTS.map((s) => (
                  <Badge key={s} apparence={STATUTS_COMMANDE[s]} taille="md" />
                ))}
              </div>
              <span className="text-[13px] leading-[19px] text-texte-3">
                Toujours une icône et un libellé : un état n&apos;est jamais indiqué par la couleur seule.
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
