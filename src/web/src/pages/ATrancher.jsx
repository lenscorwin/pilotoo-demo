/**
 * À trancher : les arbitrages en attente, les points de vigilance et les
 * retours d'outils attendus, sortis de la vue générale le 2026-10-21.
 *
 * Vus en liste sur la vue générale, ils pesaient sur tout l'écran du matin.
 * Ici on vient les chercher quand on a la tête à ça, et une seule famille
 * s'affiche à la fois : on choisit sa tuile, le reste attend. Les points
 * sont rangés par projet, ce qui lit mieux qu'une liste plate de vingt
 * lignes. L'onglet choisi vit dans l'URL (`#/a-trancher/vigilance`).
 */
import React from "react";
import { Scale, AlertTriangle, Hourglass, ArrowUpRight } from "lucide-react";
import { RienASignaler } from "../components/primitives.jsx";
import { TON_STATUT, TON_ALERTE } from "../lib/format.js";
import { iconeProjet, TUILE_TON } from "../lib/icones.js";

const FAMILLES = [
  {
    id: "arbitrages",
    titre: "Arbitrages",
    detail: "décisions en attente",
    vide: "Rien à trancher.",
    icone: Scale,
  },
  {
    id: "vigilance",
    titre: "Vigilance",
    detail: "points signalés",
    vide: "Rien à signaler.",
    icone: AlertTriangle,
  },
  {
    id: "retours",
    titre: "Retours d'outils",
    detail: "outils attendent ton avis",
    vide: "Tout ce qui a servi est évalué.",
    icone: Hourglass,
  },
];

/** Rassemble les points d'une famille, projet par projet. */
function grouper(projets, famille) {
  return projets
    .map((p) => {
      let items = [];
      if (famille === "arbitrages") items = (p.arbitrages ?? []).map((a) => ({ texte: a.texte }));
      if (famille === "vigilance")
        items = [
          ...(p.alertes ?? [])
            .filter((a) => a.niveau === "urgent" || a.niveau === "attention")
            .map((a) => ({ texte: a.texte, ton: TON_ALERTE[a.niveau] })),
          ...(p.vigilance ?? []).map((v) => ({ texte: v.texte })),
        ];
      if (famille === "retours" && p.bilan?.resume?.attente) {
        const r = p.bilan.resume;
        items = [
          {
            texte: [
              r.aReporter && `${r.aReporter} à reporter`,
              r.aEvaluer && `${r.aEvaluer} à évaluer`,
              r.ficheManquante && `${r.ficheManquante} fiche${r.ficheManquante > 1 ? "s" : ""} à créer`,
              r.noteManquante && `${r.noteManquante} note${r.noteManquante > 1 ? "s" : ""} à donner`,
            ]
              .filter(Boolean)
              .join(" · "),
            noms: p.bilan.sujets.filter((s) => s.attente).map((s) => s.nom),
          },
        ];
      }
      return { projet: p, items };
    })
    .filter((g) => g.items.length)
    .sort((a, b) => b.items.length - a.items.length);
}

function compter(resume, id) {
  if (id === "arbitrages") return resume.nbArbitrages;
  if (id === "vigilance") return resume.nbVigilance;
  return resume.bilan?.attente ?? 0;
}

export default function ATrancher({ etat, aller, ancre }) {
  const { projets, resume } = etat;
  const actif = FAMILLES.some((f) => f.id === ancre) ? ancre : "arbitrages";
  const famille = FAMILLES.find((f) => f.id === actif);
  const groupes = grouper(projets, actif);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-8">
      <header className="mb-8">
        <p className="t-surtitre">Quand tu as la tête à ça</p>
        <h1 className="t-display mt-2">À trancher</h1>
        <p className="t-chapo mt-3 max-w-2xl">
          Une famille à la fois, rangée par projet. Rien ici n'est urgent tant que la vue générale ne le dit pas.
        </p>
      </header>

      {/* Les trois tuiles servent d'onglets : la choisie passe en bleu nuit. */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Familles">
        {FAMILLES.map((f) => {
          const choisi = f.id === actif;
          const n = compter(resume, f.id);
          const Icone = f.icone;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={choisi}
              onClick={() => aller({ vue: "a-trancher", ancre: f.id })}
              className={`bento bento-lien flex items-center gap-4 p-5 text-left ${choisi ? "nuit !bg-fond" : ""}`}
            >
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                  choisi ? "bg-lavande text-encre" : "bg-lavande-pale text-lavande-encre"
                }`}
              >
                <Icone size={21} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="tabulaire block font-title text-[34px] font-semibold leading-none text-texte">{n}</span>
                <span className="mt-1 block text-[13px] font-bold text-texte">{f.titre}</span>
                <span className="block text-[12px] text-texte-3">{n ? f.detail : f.vide}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section role="tabpanel" aria-label={famille.titre} key={actif}>
        {groupes.length === 0 ? (
          <div className="bento p-6">
            <RienASignaler>{famille.vide}</RienASignaler>
          </div>
        ) : (
          // Colonnes plutôt que grille : chaque carte garde sa hauteur, comme une mosaïque.
          <div className="columns-1 gap-4 lg:columns-2">
            {groupes.map(({ projet, items }, i) => (
              <CarteProjet
                key={projet.id}
                projet={projet}
                items={items}
                delai={i * 30}
                ouvrir={() =>
                  aller({ vue: "projet", id: projet.id, onglet: actif === "retours" ? "usage" : undefined })
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CarteProjet({ projet, items, ouvrir, delai }) {
  const Icone = iconeProjet(projet);
  const ton = TON_STATUT[projet.statut] ?? "termine";
  return (
    <article className="bento monter mb-4 break-inside-avoid p-5" style={{ animationDelay: `${delai}ms` }}>
      <header className="mb-3 flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${TUILE_TON[ton] ?? TUILE_TON.termine}`} aria-hidden="true">
          <Icone size={20} strokeWidth={1.8} />
        </span>
        <h2 className="t-h3 min-w-0 flex-1 truncate">{projet.nom}</h2>
        <span className="tabulaire rounded-full bg-lavande-pale px-2.5 py-0.5 text-[12px] font-bold text-lavande-encre">
          {items.length}
        </span>
        <button
          onClick={ouvrir}
          className="rond-fleche bg-fond text-texte hover:bg-lavande hover:text-encre"
          title={`Ouvrir ${projet.nom}`}
          aria-label={`Ouvrir ${projet.nom}`}
        >
          <ArrowUpRight size={16} strokeWidth={2.2} />
        </button>
      </header>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-fond/70 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-texte-2">
            <span
              className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${
                it.ton === "bloque" ? "bg-bloque" : it.ton === "pause" ? "bg-pause" : "bg-lavande-encre"
              }`}
            />
            <span className="min-w-0">
              <TexteMd texte={it.texte} />
              {it.noms && <span className="mt-0.5 block text-[12px] text-texte-3">{it.noms.join(", ")}</span>}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Le strict nécessaire du markdown en ligne des etat.md : barré, gras, code.
 * Sans lui, un arbitrage tranché s'affichait avec ses `~~` autour.
 */
function TexteMd({ texte }) {
  if (typeof texte !== "string") return texte;
  const morceaux = texte.split(/(~~[^~]+~~|\*\*[^*]+\*\*|`[^`]+`)/g);
  return morceaux.map((m, i) => {
    if (m.startsWith("~~") && m.endsWith("~~")) return <s key={i} className="text-texte-3">{m.slice(2, -2)}</s>;
    if (m.startsWith("**") && m.endsWith("**")) return <strong key={i} className="text-texte">{m.slice(2, -2)}</strong>;
    if (m.startsWith("`") && m.endsWith("`"))
      return (
        <code key={i} className="rounded bg-fond-3 px-1 py-0.5 text-[12px]">
          {m.slice(1, -1)}
        </code>
      );
    return m;
  });
}
