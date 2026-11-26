/**
 * Briques visuelles partagées.
 *
 * Une règle tenue partout : un état n'est jamais signalé par la seule couleur.
 * Chaque pastille porte un libellé, chaque barre porte son pourcentage.
 */
import React, { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";

/*
 * Fond des pastilles : une teinte à 6 % mélangée à la surface (`fond-2`),
 * opaque : blanche en clair, bleu profond dans un bloc `.nuit`. Une
 * transparence se colorait de la surface du dessous et le teal tombait sous
 * 4,5:1 sur une ligne grise ; opaque, le contraste est le même partout.
 */
const TONS = {
  actif: "text-actif border-actif/35 bg-[color-mix(in_srgb,var(--color-actif)_6%,var(--color-fond-2))]",
  pause: "text-pause border-pause/35 bg-[color-mix(in_srgb,var(--color-pause)_6%,var(--color-fond-2))]",
  bloque: "text-bloque border-bloque/35 bg-[color-mix(in_srgb,var(--color-bloque)_6%,var(--color-fond-2))]",
  termine: "text-texte-3 border-bord bg-fond-3",
  arbitrage: "text-arbitrage border-arbitrage/35 bg-[color-mix(in_srgb,var(--color-arbitrage)_6%,var(--color-fond-2))]",
  accent: "text-accent border-accent/35 bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-fond-2))]",
};

export function Pastille({ ton = "termine", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap ${TONS[ton] ?? TONS.termine} ${className}`}
    >
      {children}
    </span>
  );
}

export function Carte({ children, className = "", onClick, delai = 0 }) {
  const interactif = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      role={interactif ? "button" : undefined}
      tabIndex={interactif ? 0 : undefined}
      onKeyDown={interactif ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick(e)) : undefined}
      style={delai ? { animationDelay: `${delai}ms` } : undefined}
      className={`monter rounded-2xl border border-bord bg-fond-2 shadow-douce transition duration-200 ${
        interactif
          ? "cursor-pointer hover:-translate-y-px hover:border-vert-bord hover:shadow-haute active:scale-[0.99] active:shadow-douce"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Barre d'avancement. Le pourcentage est toujours écrit à côté. */
export function Jauge({ valeur, ton = "actif" }) {
  if (valeur == null) return null;
  const couleurs = { actif: "bg-actif", pause: "bg-pause", bloque: "bg-bloque", termine: "bg-texte-3" };
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-fond-3"
        role="progressbar"
        aria-valuenow={valeur}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${couleurs[ton] ?? couleurs.actif}`}
          style={{ width: `${valeur}%` }}
        />
      </div>
      <span className="tabulaire w-9 text-right text-[11px] text-texte-3">{valeur}%</span>
    </div>
  );
}

export function Tuile({ libelle, valeur, detail, ton = "termine" }) {
  const teintes = {
    actif: "text-actif",
    pause: "text-pause",
    bloque: "text-bloque",
    arbitrage: "text-arbitrage",
    accent: "text-accent",
    termine: "text-texte",
  };
  return (
    <div className="monter rounded-xl border border-bord bg-fond-2 px-4 py-4 shadow-douce">
      <div className="t-label">{libelle}</div>
      <div className={`tabulaire mt-2 font-title text-[34px] leading-none ${teintes[ton] ?? teintes.termine}`}>
        {valeur}
      </div>
      {detail && <div className="mt-2 text-[12px] leading-snug text-texte-3">{detail}</div>}
    </div>
  );
}

/** Points de couleur des puces. Chaque ton est toujours doublé d'un libellé. */
const POINTS = {
  actif: "bg-actif",
  pause: "bg-pause",
  bloque: "bg-bloque",
  arbitrage: "bg-arbitrage",
  accent: "bg-accent",
  termine: "bg-texte-3",
};

/**
 * Le « rien à signaler » est une information, pas une absence d'information.
 * Il porte donc sa propre pastille verte, au même endroit et de la même taille
 * que les puces des entrées : l'œil lit la couleur avant de lire le texte.
 */
export function RienASignaler({ children }) {
  return (
    <p className="flex items-center gap-3 text-sm text-texte-3">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-actif" />
      {children}
    </p>
  );
}

/**
 * Titre de section (niveau 2 de l'échelle) : l'icône dans une pastille verte,
 * le titre en Outfit 24 px, le compteur à côté. `surtitre` ajoute une ligne
 * en capitales vertes au-dessus, `chapo` une phrase dessous.
 */
export function Section({ titre, compte, children, vide, icone: Icone, tonCompte = "vert", surtitre, chapo }) {
  const teintes = {
    vert: "bg-vert-pale text-actif",
    bloque: "bg-[color-mix(in_srgb,var(--color-bloque)_8%,var(--color-fond-2))] text-bloque",
    pause: "bg-[color-mix(in_srgb,var(--color-pause)_8%,var(--color-fond-2))] text-pause",
    arbitrage: "bg-[color-mix(in_srgb,var(--color-arbitrage)_8%,var(--color-fond-2))] text-arbitrage",
    accent: "bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-fond-2))] text-accent",
    termine: "bg-fond-3 text-texte-3",
  };
  return (
    <section className="monter">
      <div className="mb-4">
        {surtitre && <div className="t-surtitre mb-1.5">{surtitre}</div>}
        <div className="flex items-center gap-3">
          {Icone && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-vert-pale text-vert" aria-hidden="true">
              <Icone size={18} strokeWidth={2.2} />
            </span>
          )}
          <h2 className="t-h2">{titre}</h2>
          {compte != null && compte > 0 && (
            <span className={`tabulaire rounded-full px-2.5 py-0.5 text-[13px] font-bold ${teintes[tonCompte] ?? teintes.termine}`}>
              {compte}
            </span>
          )}
        </div>
        {chapo && <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-texte-2">{chapo}</p>}
      </div>
      {compte === 0 && vide ? <RienASignaler>{vide}</RienASignaler> : children}
    </section>
  );
}

/** Liste à puces sobre, avec date optionnelle en tête de ligne. */
export function Puces({ items, ton = "termine", vide = "Rien à afficher." }) {
  if (!items?.length) return <RienASignaler>{vide}</RienASignaler>;
  const points = POINTS;
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-texte-2">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${points[ton] ?? points.termine}`} />
          <span className="min-w-0">
            {it.date && <span className="tabulaire mr-2 text-texte-3">{it.date}</span>}
            {it.texte}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Copie un texte dans le presse-papiers, côté navigateur seulement : rien ne
 * passe par le serveur. 127.0.0.1 compte comme contexte sécurisé, l'API
 * Clipboard y est donc disponible.
 *
 * Posé dans une carte cliquable, le bouton arrête la propagation du clic et
 * des touches : sans ça, copier ouvrirait aussi le projet.
 */
export function BoutonCopier({ texte, libelle, titre = "Copier dans le presse-papiers", className = "" }) {
  const [copie, setCopie] = useState(false);
  const minuteur = useRef(null);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  const copier = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => setCopie(false), 1600);
    } catch {
      // Refus du navigateur : le bouton reste tel quel, rien à simuler.
    }
  };

  const Icone = copie ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copier}
      onKeyDown={(e) => e.stopPropagation()}
      title={titre}
      aria-label={libelle ? undefined : titre}
      className={`flex shrink-0 items-center gap-2 rounded-lg border border-actif/55 bg-actif/[0.06] text-texte-2 transition hover:border-actif hover:bg-actif/10 hover:text-texte active:scale-95 ${
        libelle ? "px-3 py-2 text-[12px]" : "p-1"
      } ${className}`}
    >
      <Icone size={13} strokeWidth={2} className="text-actif" />
      {libelle && (copie ? "Chemin copié" : libelle)}
      <span className="sr-only" aria-live="polite">
        {copie ? "Copié" : ""}
      </span>
    </button>
  );
}
