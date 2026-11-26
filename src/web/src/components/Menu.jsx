/**
 * Menu latéral : la navigation principale et le bouton de rafraîchissement.
 *
 * Les projets sont regroupés par statut plutôt que listés à plat : c'est
 * l'information qu'on cherche en ouvrant le menu, pas l'ordre alphabétique.
 *
 * Le menu est en bleu profond (`.nuit`) : la seule colonne sombre de l'écran,
 * elle sert de repère fixe pendant que le contenu défile en clair. Depuis la
 * passe bento (2026-10-21), c'est un panneau flottant arrondi, et la page
 * active est une pilule lavande.
 */
import React from "react";
import { LayoutGrid, Wrench, RefreshCw, Scale, Moon, Sun } from "lucide-react";
import { useTheme, basculerTheme } from "../lib/theme.js";

/**
 * La pastille jour / nuit, à côté du titre. L'icône montre le thème vers
 * lequel on passe. Le choix tient jusqu'à la prochaine bascule (22 h ou 8 h).
 */
function PastilleTheme() {
  const theme = useTheme();
  const versNuit = theme !== "nuit";
  const libelle = versNuit ? "Passer en sombre jusqu'à 8 h ou 22 h" : "Passer en clair jusqu'à 8 h ou 22 h";
  return (
    <button
      onClick={basculerTheme}
      title={versNuit ? "Passer en sombre (jusqu'à la prochaine bascule)" : "Passer en clair (jusqu'à la prochaine bascule)"}
      aria-label={libelle}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-texte-2 transition hover:bg-white/15 hover:text-texte active:scale-90"
    >
      {versNuit ? <Moon size={15} strokeWidth={2.2} /> : <Sun size={15} strokeWidth={2.2} />}
    </button>
  );
}
import { LIBELLE_STATUT, TON_STATUT, depuis } from "../lib/format.js";
import { iconeProjet } from "../lib/icones.js";

const POINTS = {
  actif: "text-actif",
  pause: "text-pause",
  bloque: "text-bloque",
  termine: "text-texte-3",
  arbitrage: "text-arbitrage",
};

const ORDRE = ["actif", "inconnu", "en-pause", "bloque", "termine"];

export default function Menu({ etat, route, aller, rafraichir, enCours }) {
  const projets = etat?.projets ?? [];
  const groupes = ORDRE.map((s) => ({ statut: s, items: projets.filter((p) => p.statut === s) })).filter(
    (g) => g.items.length
  );

  return (
    <aside className="nuit relative z-10 flex h-full w-[216px] shrink-0 flex-col overflow-hidden rounded-[28px] shadow-haute">
      <header className="px-5 pb-5 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-title text-[26px] leading-none tracking-[0.01em] text-texte">Pilotoo</h1>
          <PastilleTheme />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-texte-3">
          {etat ? (
            <>
              Relevé {depuis(etat.genereLe)}
              {" · "}
              <span className="tabulaire">{etat.resume.nbProjets}</span> projets
            </>
          ) : (
            "Chargement…"
          )}
        </p>
      </header>

      <nav className="space-y-0.5 px-3">
        <Entree actif={route.vue === "general"} onClick={() => aller({ vue: "general" })} icone={LayoutGrid}>
          Vue générale
        </Entree>
        <Entree actif={route.vue === "a-trancher"} onClick={() => aller({ vue: "a-trancher" })} icone={Scale}>
          À trancher
          {/* Un nombre calme, en lavande : il dit qu'il y a de quoi faire, sans alarme. */}
          {etat?.resume.nbArbitrages > 0 && (
            <span
              className={`tabulaire ml-auto rounded-full px-1.5 text-[10.5px] font-bold leading-[18px] ${
                route.vue === "a-trancher" ? "bg-encre/10 text-encre" : "bg-lavande-pale text-lavande-encre"
              }`}
              title={`${etat.resume.nbArbitrages} décisions en attente`}
            >
              {etat.resume.nbArbitrages}
            </span>
          )}
        </Entree>
        <Entree actif={route.vue === "outils"} onClick={() => aller({ vue: "outils" })} icone={Wrench}>
          Outils
          {etat && (
            <span className="tabulaire ml-auto text-[11px] text-texte-3">{etat.resume.outils.total}</span>
          )}
        </Entree>
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groupes.map((g) => (
          <div key={g.statut} className="mb-4">
            <div className="t-label px-2.5 pb-1.5 text-[10.5px]">
              {LIBELLE_STATUT[g.statut] ?? g.statut}
            </div>
            {g.items.map((p) => (
              <Entree
                key={p.id}
                actif={route.vue === "projet" && route.id === p.id}
                onClick={() => aller({ vue: "projet", id: p.id })}
                icone={iconeProjet(p)}
                pointTon={TON_STATUT[p.statut]}
                decisions={p.arbitrages?.length ?? 0}
                urgent={(p.alertes ?? []).some((a) => a.niveau === "urgent")}
              >
                <span className="truncate">{p.nom}</span>
              </Entree>
            ))}
          </div>
        ))}
      </div>

      <footer className="border-t border-bord-vif/60 p-3">
        <button
          onClick={rafraichir}
          disabled={enCours}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-actif px-3 py-2.5 text-[13px] font-bold text-fond transition duration-200 hover:-translate-y-px hover:bg-accent hover:shadow-marque active:translate-y-0 active:scale-[0.97] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          <RefreshCw size={14} className={enCours ? "animate-spin" : ""} strokeWidth={2.2} />
          {enCours ? "Scan en cours…" : "Rafraîchir"}
        </button>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-texte-3">
          Le scan ne lit que des métadonnées : gratuit, aucun token consommé.
        </p>
      </footer>
    </aside>
  );
}

function Entree({ actif, onClick, icone: Icone, children, pointTon, decisions = 0, urgent }) {
  return (
    <button
      onClick={onClick}
      aria-current={actif ? "page" : undefined}
      className={`group flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13px] transition active:scale-[0.98] ${
        actif ? "bg-lavande font-bold text-encre" : "text-texte-2 hover:bg-white/[0.06] hover:text-texte"
      }`}
    >
      {/* Un projet prend la teinte de son statut, qui remplace l'ancien point
          de couleur ; le libellé du groupe dit le statut en toutes lettres. */}
      <Icone
        size={pointTon ? 19 : 15}
        className={`shrink-0 ${actif ? "text-encre" : pointTon ? POINTS[pointTon] ?? POINTS.termine : "text-texte-3"}`}
        strokeWidth={2}
      />
      {children}
      {/* Le nombre se lit sans survol, là où un point demandait une infobulle. */}
      {decisions > 0 ? (
        <span
          className={`tabulaire ml-auto shrink-0 rounded-full px-1.5 text-[10.5px] font-bold leading-[18px] ${
            actif ? "bg-encre/10 text-encre" : "bg-lavande-pale text-lavande-encre"
          }`}
          title={`${decisions} décision${decisions > 1 ? "s" : ""} en attente`}
        >
          {decisions}
          <span className="sr-only"> décision{decisions > 1 ? "s" : ""} en attente</span>
        </span>
      ) : (
        urgent && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-bloque" title="Point urgent" />
      )}
    </button>
  );
}
