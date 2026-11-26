/**
 * Habillage propre à la démo publique : bandeau d'honnêteté et avis mobile.
 * Rien de tout ça n'existe dans l'outil réel (`DEMO` faux).
 */
import React from "react";
import { MonitorSmartphone, ArrowUpRight } from "lucide-react";

/** Seul lien de contact de la démo. Une ligne à changer si l'adresse bouge. */
export const CONTACT_URL = "https://graphoo.fr/#/card";

/** Date en toutes lettres, ou rien si la valeur n'est pas une date lisible. */
function dateLongue(iso) {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Bandeau discret, toujours visible : la démo dit ce qu'elle est.
 * `pointer-events-none` partout : le bandeau ne contient aucun lien, il ne
 * doit jamais intercepter un clic destiné au contenu qui défile dessous.
 */
export function BandeauDemo({ instantane }) {
  const date = dateLongue(instantane);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <p
        role="note"
        className="rounded-full border border-bord-vif bg-fond-2/90 px-4 py-1.5 text-[11.5px] text-texte-2 shadow-sm backdrop-blur"
      >
        <span className="font-semibold text-texte">Démo</span> : données nettoyées et complétées
        {date ? `, instantané du ${date}` : ""}. Méthode et outil réels.
      </p>
    </div>
  );
}

/**
 * Sous 1024 px, le dashboard est trop dense pour être lisible : on le dit
 * franchement plutôt que d'offrir une version tassée.
 */
export function AvisMobile() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fond p-8 lg:hidden">
      <div className="max-w-sm text-center">
        <MonitorSmartphone size={28} strokeWidth={1.8} className="mx-auto mb-4 text-accent" />
        <h1 className="mb-2 text-[17px] font-semibold text-texte">Démo conçue pour ordinateur</h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-texte-2">
          MyDashboard Projets est un tableau de bord dense, pensé pour un grand écran. Ouvre cette page sur un ordinateur pour
          la parcourir.
        </p>
        <a
          href={CONTACT_URL}
          className="inline-flex items-center gap-1.5 rounded-full bg-texte px-4 py-2 text-[13px] font-medium text-fond"
        >
          Me contacter sur graphoo.fr
          <ArrowUpRight size={14} strokeWidth={2.2} />
        </a>
      </div>
    </div>
  );
}
