/**
 * Les deux schémas de la section Git : le graphe des branches et le rythme
 * des commits. Les données arrivent mises en forme par le scanner
 * (`git-graphe.mjs`) ; ici on ne fait que tracer.
 *
 * Les couleurs des branches suivent la palette catégorielle de la skill
 * dataviz, dans son ordre fixe, assombrie pour le thème clair : contraste
 * mesuré de 3,9:1 au moins sur `fond` (#f8fafc). Au-delà de huit branches, gris.
 * Le texte ne prend jamais la couleur d'une branche : un trait coloré à côté
 * du nom porte l'identité, le nom reste à l'encre du texte.
 */
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { dateCourte } from "../lib/format.js";
import { maintenant } from "../lib/horloge.js";

const COULEURS = ["#2a78d6", "#c4501c", "#13865f", "#a86f00", "#c2457a", "#007600", "#7b6fd9", "#d64f4f"];
const couleur = (i) => COULEURS[i] ?? "var(--color-texte-3)";

const PAS_VOIE = 14;
const H_COMMIT = 28;
const H_PLI = 22;
const VISIBLES = 10;

const jourCourt = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Graphe des branches, à la `git log --graph`, suites sans événement repliées. */
export function GrapheBranches({ h }) {
  const [ouvert, setOuvert] = useState(false);
  const lignes = ouvert ? h.lignes : h.lignes.slice(0, VISIBLES);
  const caches = h.lignes.length - VISIBLES;

  // Ordonnée du centre de chaque ligne.
  const ys = [];
  let cumul = 0;
  for (const l of lignes) {
    const haut = l.pli ? H_PLI : H_COMMIT;
    ys.push(cumul + haut / 2);
    cumul += haut;
  }
  const largeur = h.nbVoies * PAS_VOIE + 4;
  const x = (v) => 2 + PAS_VOIE / 2 + v * PAS_VOIE;

  // Traits d'une ligne vers la suivante ; la dernière ligne affichée les
  // prolonge jusqu'au bord, l'histoire continue sous le pli.
  const traits = lignes.flatMap((l, i) => {
    const y1 = ys[i];
    const y2 = i + 1 < lignes.length ? ys[i + 1] : cumul;
    const tirets = l.pli || lignes[i + 1]?.pli;
    return l.traits.map(([a, b, br], k) => {
      const d =
        a === b
          ? `M${x(a)} ${y1} V${y2}`
          : `M${x(a)} ${y1} C${x(a)} ${(y1 + y2) / 2} ${x(b)} ${(y1 + y2) / 2} ${x(b)} ${y2}`;
      return <path key={`${i}-${k}`} d={d} stroke={couleur(br)} strokeDasharray={tirets ? "2 3" : undefined} />;
    });
  });

  return (
    <div>
      {h.branches.length > 1 && <Legende branches={h.branches} />}
      <div className="relative overflow-hidden rounded-xl border border-bord bg-fond-2 py-1.5">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2 top-0"
            width={largeur}
            height={cumul}
            aria-hidden="true"
          >
            <g fill="none" strokeWidth="2" strokeLinecap="round">
              {traits}
            </g>
            {lignes.map((l, i) =>
              l.pli ? null : (
                <circle
                  key={l.h}
                  cx={x(l.voie)}
                  cy={ys[i]}
                  r={l.etiquettes.length ? 5 : 4}
                  fill={couleur(l.branche)}
                  stroke="var(--color-fond-2)"
                  strokeWidth="2"
                />
              )
            )}
          </svg>
          <ol style={{ paddingLeft: largeur + 14 }} className="pr-3">
            {lignes.map((l, i) =>
              l.pli ? (
                <li key={`pli-${i}`} style={{ height: H_PLI }} className="flex items-center text-[11px] text-texte-3">
                  … <span className="tabulaire mx-1">{l.pli}</span> {`commit${l.pli > 1 ? "s" : ""}`}
                  <span className="ml-auto tabulaire">
                    {l.depuis.slice(0, 10) === l.jusqua.slice(0, 10)
                      ? jourCourt(l.depuis)
                      : `${jourCourt(l.jusqua)} → ${jourCourt(l.depuis)}`}
                  </span>
                </li>
              ) : (
                <li
                  key={l.h}
                  style={{ height: H_COMMIT }}
                  title={`${l.sujet}\n${l.h} · ${dateCourte(l.date)}`}
                  className="flex min-w-0 items-center gap-2 text-[12px]"
                >
                  {l.etiquettes.map((b) => (
                    <Etiquette key={b} branche={h.branches[b]} i={b} />
                  ))}
                  <span className="min-w-0 flex-1 truncate text-texte-2">{l.sujet}</span>
                  <span className="tabulaire shrink-0 text-[11px] text-texte-3">{jourCourt(l.date)}</span>
                </li>
              )
            )}
          </ol>
        </div>
      </div>
      {caches > 0 && (
        <button
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          className="mt-1.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-texte-3 transition hover:bg-fond-2 hover:text-texte-2"
        >
          <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform ${ouvert ? "rotate-180" : ""}`} />
          {ouvert ? "Réduire" : `Voir les ${caches} lignes plus anciennes`}
        </button>
      )}
      {h.tronque && (
        <p className="mt-1.5 text-[11px] text-texte-3">Historique lu sur les 400 derniers commits.</p>
      )}
    </div>
  );
}

function Etiquette({ branche, i }) {
  return (
    <span
      title={branche.nom}
      className="flex min-w-0 max-w-[45%] shrink-0 items-center gap-1.5 rounded-md border border-bord bg-fond-3 px-1.5 py-px font-mono text-[10.5px] text-texte-2"
    >
      <span className="h-[3px] w-2.5 shrink-0 rounded-full" style={{ background: couleur(i) }} />
      <span className="truncate">{branche.nom}</span>
    </span>
  );
}

function Legende({ branches }) {
  return (
    <ul className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-texte-2">
      {branches.map((b, i) => (
        <li key={b.nom} className="flex min-w-0 max-w-full items-center gap-1.5">
          <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: couleur(i) }} />
          <span className="truncate font-mono" title={b.nom}>{b.nom}</span>
          {b.courante && <span className="text-texte-3">· courante</span>}
          {b.distante && !b.suit && <span className="text-texte-3">· distante seulement</span>}
          {b.suit && (
            <span className="text-texte-3">
              ·{" "}
              {[
                b.suit.avance > 0 && `${b.suit.avance} commit${b.suit.avance > 1 ? "s" : ""} non poussé${b.suit.avance > 1 ? "s" : ""} sur ${b.suit.nom}`,
                b.suit.retard > 0 && `${b.suit.retard} à récupérer`,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          {b.publiee && <span className="text-texte-3">· à jour sur le distant</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Découpe le compte par jour en colonnes contiguës, jours vides compris :
 * un creux d'activité doit se voir. Le pas s'adapte à l'âge du dépôt.
 */
function colonnes(parJour) {
  const jours = Object.keys(parJour).sort();
  if (!jours.length) return { pas: "jour", cols: [] };
  const local = (j) => {
    const [a, m, d] = j.split("-").map(Number);
    return new Date(a, m - 1, d);
  };
  const debut = local(jours[0]);
  const fin = new Date(maintenant());
  fin.setHours(0, 0, 0, 0);
  const duree = (fin - debut) / 864e5;
  const pas = duree <= 31 ? "jour" : duree <= 280 ? "semaine" : "mois";

  const cle = (d) => {
    if (pas === "jour") return d.toDateString();
    if (pas === "mois") return `${d.getFullYear()}-${d.getMonth()}`;
    const lundi = new Date(d);
    lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return lundi.toDateString();
  };
  const cols = [];
  const index = new Map();
  for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
    const k = cle(d);
    if (!index.has(k)) {
      index.set(k, cols.length);
      cols.push({ debut: new Date(d), n: 0 });
    }
  }
  for (const j of jours) cols[index.get(cle(local(j)))].n += parJour[j];
  return { pas, cols };
}

function libelleColonne(c, pas) {
  if (pas === "jour") return c.debut.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  if (pas === "mois") return c.debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return `semaine du ${c.debut.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

/** Nombre de commits déposés, et leur rythme dans le temps. */
export function RythmeCommits({ h }) {
  const { pas, cols } = colonnes(h.parJour);
  const [survol, setSurvol] = useState(null);
  if (!cols.length) return null;
  const max = Math.max(...cols.map((c) => c.n));
  const actives = cols.filter((c) => c.n > 0).length;
  const parPas = { jour: "par jour", semaine: "par semaine", mois: "par mois" }[pas];
  const unite = { jour: "jours", semaine: "semaines", mois: "mois" }[pas];

  return (
    <div className="rounded-xl border border-bord bg-fond-2 p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="tabulaire font-title text-[28px] leading-none text-texte">{h.total}</span>
        <span className="text-[13px] text-texte-2">{`commit${h.total > 1 ? "s" : ""}`}</span>
        <span className="ml-auto text-[11px] text-texte-3">
          {parPas} · actif <span className="tabulaire">{actives}</span> {unite} sur{" "}
          <span className="tabulaire">{cols.length}</span>
        </span>
      </div>

      <div className="relative">
        <span className="tabulaire absolute -top-0.5 left-0 text-[10px] text-texte-3">{max}</span>
        <div
          className="flex h-24 items-end gap-[2px] border-b border-bord-vif pl-5"
          role="img"
          aria-label={`${h.total} commits ${parPas}, au plus ${max} sur une même période`}
          onPointerLeave={() => setSurvol(null)}
        >
          {cols.map((c, i) => (
            <div
              key={i}
              onPointerEnter={() => setSurvol(i)}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
            >
              {c.n > 0 && (
                <div
                  className={`w-full max-w-[28px] rounded-t-[4px] transition-colors ${
                    survol === i ? "bg-accent" : "bg-actif"
                  }`}
                  style={{ height: `${(c.n / max) * 100}%` }}
                />
              )}
            </div>
          ))}
        </div>
        {survol != null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-bord-vif bg-fond-3 px-2.5 py-1.5 shadow-haute"
            style={{ left: `calc(1.25rem + (100% - 1.25rem) * ${(survol + 0.5) / cols.length})` }}
          >
            <span className="tabulaire block text-[13px] font-semibold text-texte">
              {cols[survol].n} {`commit${cols[survol].n > 1 ? "s" : ""}`}
            </span>
            <span className="block text-[11px] text-texte-3">{libelleColonne(cols[survol], pas)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between pl-5 text-[10px] text-texte-3">
          <span>{libelleColonne(cols[0], pas)}</span>
          <span>{pas === "jour" ? "aujourd'hui" : libelleColonne(cols[cols.length - 1], pas)}</span>
        </div>
      </div>

      <details className="mt-3 border-t border-bord pt-2.5">
        <summary className="cursor-pointer text-[12px] font-medium text-texte-3 hover:text-texte-2">
          Voir le tableau
        </summary>
        <table className="mt-2 w-full text-[12px]">
          <tbody>
            {cols
              .filter((c) => c.n > 0)
              .reverse()
              .map((c, i) => (
                <tr key={i} className="border-b border-bord last:border-0">
                  <td className="py-1 text-texte-3">{libelleColonne(c, pas)}</td>
                  <td className="tabulaire py-1 text-right text-texte-2">{c.n}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
