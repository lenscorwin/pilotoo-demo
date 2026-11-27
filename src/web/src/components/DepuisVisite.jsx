/**
 * « Depuis ta dernière visite » : ce qui a bougé, sur la vue générale.
 *
 * Depuis le 2026-11-08, le détail n'est plus un bloc à part : chaque tuile
 * projet porte sa propre liste (`ListeVisite`). Il ne reste en tête qu'une
 * barre de compteurs avec « Marquer comme vu » (`BarreVisite`).
 *
 * La date de visite est gardée dans le navigateur : c'est une commodité de
 * lecture, pas une donnée du projet. Elle n'avance que sur « Marquer comme
 * vu » : un simple rechargement ne fait pas disparaître le bilan. Sans date
 * connue, le bilan couvre les dernières 24 heures.
 */
import React, { useEffect, useState } from "react";
import { Check, Scale, History, Sparkles, ChevronRight } from "lucide-react";
import { chargerProgres } from "../lib/api.js";
import { depuis as ilYA } from "../lib/format.js";
import { maintenant } from "../lib/horloge.js";

const CLE = "pilotoo.derniereVisite";

function lireVisite() {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

function ecrireVisite(iso) {
  try {
    localStorage.setItem(CLE, iso);
  } catch {
    // Stockage refusé : le bilan reviendra au prochain chargement, sans gravité.
  }
}

/**
 * Charge le bilan depuis la dernière visite. Rend `{ bilan, parProjet, marquerVu }` :
 * `parProjet` donne le détail d'un projet par son id, ou rien s'il n'a pas bougé.
 */
export function useDepuisVisite(etat) {
  const [visite, setVisite] = useState(() => {
    // Une visite notée « après » l'heure de référence (démo figée, visite réelle
    // plus récente) viderait le bilan : on repart alors de la veille.
    const notee = lireVisite();
    if (notee && new Date(notee).getTime() <= maintenant()) return notee;
    return new Date(maintenant() - 86_400_000).toISOString();
  });
  const [bilan, setBilan] = useState(null);

  // Rechargé à chaque nouveau scan : une étape cochée ailleurs apparaît ici.
  useEffect(() => {
    chargerProgres(visite).then(setBilan).catch(() => setBilan(null));
  }, [visite, etat.genereLe]);

  const marquerVu = () => {
    const vuLe = new Date(maintenant()).toISOString();
    ecrireVisite(vuLe);
    setVisite(vuLe);
  };

  const parProjet = Object.fromEntries((bilan?.projets ?? []).map((d) => [d.id, d]));
  return { bilan, parProjet, marquerVu };
}

/** La barre de tête : depuis quand, les totaux, et le bouton. Masquée s'il n'y a rien. */
export function BarreVisite({ bilan, marquerVu }) {
  if (!bilan || !bilan.projets.length) return null;
  const { total } = bilan;
  return (
    <section
      className="bento monter mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4"
      aria-label="Depuis ta dernière visite"
    >
      <div>
        <h2 className="t-h3 text-[20px]">Depuis ta dernière visite</h2>
        <p className="text-[12px] text-texte-3">
          {ilYA(bilan.depuis)}, le détail est dans chaque projet
        </p>
      </div>
      <Compteur valeur={total.closes} libelle={total.closes > 1 ? "étapes bouclées" : "étape bouclée"} />
      <Compteur valeur={total.tranches} libelle={total.tranches > 1 ? "arbitrages tranchés" : "arbitrage tranché"} delai={80} />
      <Compteur valeur={total.sessions} libelle={total.sessions > 1 ? "sessions" : "session"} delai={160} />
      <Compteur valeur={total.jalons} libelle={total.jalons > 1 ? "jalons" : "jalon"} delai={240} accent />
      <button
        onClick={marquerVu}
        className="ml-auto flex items-center gap-1.5 rounded-lg border border-bord px-3 py-1.5 text-[12px] text-texte-2 transition hover:border-bord-vif hover:bg-fond-2 hover:text-texte active:scale-[0.97]"
      >
        <Check size={13} strokeWidth={2.2} />
        Marquer comme vu
      </button>
    </section>
  );
}

/** Les puces de session arrivent parfois avec un « · » de tête : on le retire. */
const nettoyer = (t) => String(t ?? "").replace(/^[\s·]+/, "").trim();

/**
 * Ce qui a bougé pour un projet : jalons, étapes bouclées, arbitrages
 * tranchés, sessions. `max` coupe la liste, le reste est annoncé en nombre.
 *
 * `complements` : les dernières sessions du projet (etat.md). Elles complètent
 * la liste jusqu'à `max` quand il a peu bougé, sous « Plus tôt », en retrait,
 * pour ne jamais passer pour du neuf.
 */
export function ListeVisite({ detail, complements = [], max = Infinity }) {
  const neuves = detail
    ? [
        ...detail.jalons.map((j) => ({ type: "jalon", texte: libelleJalon(j) })),
        ...detail.closes.map((t) => ({ type: "close", texte: t })),
        ...detail.tranches.map((t) => ({ type: "tranche", texte: t })),
        ...detail.sessions.map((t) => ({ type: "session", texte: nettoyer(t) })),
      ]
    : [];
  const visibles = neuves.slice(0, max);
  const reste = neuves.length - visibles.length;

  // Une session déjà listée comme nouvelle ne revient pas sous « Plus tôt ».
  const dejaVues = visibles.map((l) => l.texte);
  const anciennes = complements
    .map((s) => ({ texte: nettoyer(s.texte), date: s.date }))
    .filter((s) => s.texte && !dejaVues.some((t) => t.includes(s.texte) || s.texte.includes(t)))
    .slice(0, 3);

  if (!visibles.length && !anciennes.length) return <p className="text-[12.5px] text-texte-3">Rien de neuf.</p>;

  return (
    <div className="space-y-2">
      {visibles.length > 0 ? (
        <Lignes lignes={visibles} reste={reste} />
      ) : (
        <p className="text-[12.5px] text-texte-3">Rien de neuf.</p>
      )}
      {/* Repliée par défaut : le neuf se lit d'abord, l'ancien se déplie à la demande.
          Les clics restent dans la section, sans ouvrir la fiche du projet. */}
      {anciennes.length > 0 && (
        <details
          className="group/plus"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-texte-3/80 transition hover:text-texte-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight size={12} strokeWidth={2.4} className="transition-transform group-open/plus:rotate-90" />
            Plus tôt ({anciennes.length})
          </summary>
          <ul className="mt-2 space-y-2 text-[12px] leading-snug">
            {anciennes.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-texte-3">
                <History size={12} strokeWidth={2} className="mt-0.5 shrink-0 opacity-70" />
                <span >
                  {s.date && <span className="tabulaire">{s.date.slice(5).split("-").reverse().join("/")} · </span>}
                  {s.texte}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Lignes({ lignes, reste }) {
  return (
    <ul className="space-y-2 text-[12.5px] leading-snug">
      {lignes.map((l, i) => (
        <li key={i} className="flex items-start gap-2">
          {l.type === "jalon" && (
            <>
              <Sparkles size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" />
              <span className="font-medium text-accent">{l.texte}</span>
            </>
          )}
          {l.type === "close" && (
            <>
              <Check size={13} strokeWidth={2.6} className="mt-0.5 shrink-0 text-actif" />
              <span className="text-texte-2 line-through decoration-texte-3/50">{l.texte}</span>
            </>
          )}
          {l.type === "tranche" && (
            <>
              <Scale size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-arbitrage" />
              <span className="text-texte-2">Tranché : {l.texte}</span>
            </>
          )}
          {l.type === "session" && (
            <>
              <History size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-texte-3" />
              <span className="text-texte-3">{l.texte}</span>
            </>
          )}
        </li>
      ))}
      {reste > 0 && <li className="pl-5 text-[12px] text-texte-3">et {reste} de plus, sur la page du projet</li>}
    </ul>
  );
}

function Compteur({ valeur, libelle, delai = 0, accent }) {
  if (!valeur) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`chiffre-monte tabulaire font-title text-[28px] leading-none ${accent ? "text-accent" : "text-actif"}`}
        style={{ animationDelay: `${delai}ms` }}
      >
        {valeur}
      </span>
      <span className="text-[12px] text-texte-2">{libelle}</span>
    </div>
  );
}

function libelleJalon(j) {
  if (j.type === "palier") return j.valeur === 100 ? "Toutes les étapes bouclées" : `Palier ${j.valeur} % franchi`;
  if (j.type === "arbitrages-vides") return "Plus aucun arbitrage en attente";
  if (j.type === "termine") return "Projet terminé";
  return j.type;
}
