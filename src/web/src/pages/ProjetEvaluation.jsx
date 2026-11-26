/**
 * Archive des conclusions d'essai : onglet du projet qui héberge le catalogue.
 *
 * Le partage décidé le 2026-09-23 : l'essai reste dans le projet qui l'a mené,
 * ici n'arrive que la conclusion. Cette page répond donc à trois questions :
 * qu'est-ce qui a été éprouvé, sur quel projet, et qu'est-ce qui a été jugé
 * ailleurs sans jamais remonter jusqu'ici.
 */
import React, { useMemo, useState } from "react";
import {
  Search, FileText, FlaskConical, CircleCheck, CircleDashed, ArchiveX,
  FolderOpen, Star, ArrowRight,
} from "lucide-react";
import { Pastille, Section, RienASignaler } from "../components/primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { LIBELLE_ETAT_OUTIL, TON_ETAT_OUTIL } from "../lib/format.js";

const LIBELLE_ISSUE = { retenu: "Retenu", ecarte: "Écarté", "a revoir": "À revoir" };
const TON_ISSUE = { retenu: "actif", ecarte: "bloque", "a revoir": "pause" };

/** Note et verdict d'un retour, quand il a été écrit au format enrichi. */
function Jugement({ note, issue }) {
  if (note == null && !issue) return null;
  return (
    <>
      {note != null && (
        <Pastille ton="accent">
          <Star size={10} strokeWidth={2.6} />
          {note}/5
        </Pastille>
      )}
      {issue && <Pastille ton={TON_ISSUE[issue] ?? "termine"}>{LIBELLE_ISSUE[issue] ?? issue}</Pastille>}
    </>
  );
}

const VUES = [
  { cle: "projet", libelle: "Par projet" },
  { cle: "outil", libelle: "Par outil" },
];

export default function ProjetEvaluation({ etat, aller }) {
  const [vue, setVue] = useState("projet");
  const [q, setQ] = useState("");

  // Dédoublonné par clé : l'index range certains outils dans deux catégories, ce qui
  // est juste pour le classement mais fausserait un décompte d'évaluation.
  const outils = useMemo(
    () => [...new Map((etat.outils ?? []).map((o) => [o.cle, o])).values()],
    [etat]
  );
  const eprouves = outils.filter((o) => o.eprouve);

  /** Toutes les conclusions archivées, aplaties en une ligne par (outil, essai). */
  const conclusions = useMemo(
    () =>
      outils.flatMap((o) =>
        (o.retours ?? []).map((r) => ({
          outil: o,
          ...r,
          // Un « pas encore testé » est une note d'installation, pas un verdict.
          simpleInstallation: /pas encore test|non test/i.test(r.texte),
        }))
      ),
    [outils]
  );

  /** Ce qui a été jugé dans un projet sans jamais rejoindre l'archive. */
  const aReporter = useMemo(
    () =>
      (etat.projets ?? [])
        .filter((p) => p.banc)
        .flatMap((p) => p.banc.essais.filter((e) => e.aReporter).map((e) => ({ projet: p, essai: e }))),
    [etat]
  );

  const filtre = (texte) => !q.trim() || texte.toLowerCase().includes(q.trim().toLowerCase());

  return (
    <div className="space-y-8">
      <Resume total={outils.length} eprouves={eprouves.length} conclusions={conclusions} aReporter={aReporter.length} />

      <Section
        titre="En attente de report"
        compte={aReporter.length}
        icone={ArchiveX}
        tonCompte="bloque"
        vide="Toutes les conclusions d'essai ont rejoint l'archive."
      >
        <div className="space-y-2">
          {aReporter.map(({ projet, essai }, i) => (
            <div key={i} className="rounded-r-lg border-l-2 border-l-bloque bg-fond-2 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[13.5px] font-medium text-texte">{essai.nom}</span>
                <span className="tabulaire text-[11px] text-texte-3">{essai.date}</span>
                {essai.note != null && (
                  <Pastille ton="accent">
                    <Star size={10} strokeWidth={2.6} />
                    {essai.note}/5
                  </Pastille>
                )}
                <button
                  onClick={() => aller({ vue: "projet", id: projet.id, onglet: "essais" })}
                  className="ml-auto flex items-center gap-1.5 text-[11px] text-texte-3 transition hover:text-texte"
                >
                  testé sur {projet.nom}
                  <ArrowRight size={12} strokeWidth={2} />
                </button>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-texte-2">{essai.verdict}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-bloque">
                {essai.aUneFiche
                  ? "La fiche de cet outil ne porte aucun retour pour ce projet."
                  : "Aucune fiche à son nom au catalogue : elle reste à créer."}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        {VUES.map((v) => (
          <button
            key={v.cle}
            onClick={() => setVue(v.cle)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
              vue === v.cle
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-bord bg-fond-2 text-texte-2 hover:border-bord-vif hover:text-texte"
            }`}
          >
            {v.libelle}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texte-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un outil, un projet…"
            aria-label="Chercher dans les conclusions"
            className="w-60 rounded-lg border border-bord bg-fond-2 py-1.5 pl-9 pr-3 text-[12px] text-texte placeholder:text-texte-3 focus:border-accent/50 focus:outline-none"
          />
        </div>
      </div>

      {vue === "projet" ? (
        <ParProjet conclusions={conclusions} filtre={filtre} etat={etat} aller={aller} />
      ) : (
        <ParOutil outils={outils} filtre={filtre} />
      )}
    </div>
  );
}

function Resume({ total, eprouves, conclusions, aReporter }) {
  const verdicts = conclusions.filter((c) => !c.simpleInstallation).length;
  const projets = new Set(conclusions.map((c) => c.projet).filter(Boolean)).size;

  return (
    <div className="rounded-xl border border-bord bg-fond-2 p-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Chiffre valeur={eprouves} sur={total} libelle="outils avec un retour consigné" />
        <Chiffre valeur={verdicts} libelle="conclusions d'essai archivées" />
        <Chiffre valeur={projets} libelle="projets ayant produit un retour" />
        <Chiffre valeur={aReporter} libelle="en attente de report" alerte={aReporter > 0} />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fond-3">
        <div
          className="h-full rounded-full bg-actif transition-[width] duration-700"
          style={{ width: `${total ? (eprouves / total) * 100 : 0}%` }}
        />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-texte-3">
        Cette page est l'<strong className="text-texte-2">archive des conclusions</strong>. Les essais eux-mêmes (le
        brief, le coût, la comparaison) restent dans le projet où ils ont été menés, et sont accessibles par le lien
        de chaque ligne.
      </p>
    </div>
  );
}

function Chiffre({ valeur, sur, libelle, alerte }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className={`tabulaire font-title text-[30px] leading-none ${alerte ? "text-bloque" : "text-texte"}`}>
        {valeur}
      </span>
      <span className="text-[12px] text-texte-2">
        {sur != null && <span className="tabulaire text-texte-3">/{sur} </span>}
        {libelle}
      </span>
    </span>
  );
}

/** Regroupement par projet : « quel outil a été testé où », l'ordre demandé. */
function ParProjet({ conclusions, filtre, etat, aller }) {
  const groupes = useMemo(() => {
    const projets = etat.projets ?? [];

    // Le champ « projet » des fiches est du texte libre. On le rattache à un
    // projet suivi via ses alias, sinon « portfolio » et « portfolio & digital
    // card » deviendraient deux historiques distincts du même terrain.
    const rattacher = (libelle) => {
      const t = (libelle ?? "").trim().toLowerCase();
      if (!t) return null;
      return projets.find((p) => (p.alias ?? [p.nom]).some((a) => a.toLowerCase() === t)) ?? null;
    };

    const m = new Map();
    for (const c of conclusions) {
      const suivi = rattacher(c.projet);
      const cle = suivi ? suivi.id : c.projet || "hors-projet";
      if (!m.has(cle)) {
        m.set(cle, { nom: suivi ? suivi.nom : c.projet || "Projet non précisé", suivi, items: [] });
      }
      // Le libellé d'origine reste visible : il dit comment c'était écrit.
      m.get(cle).items.push({ ...c, libelleOrigine: suivi && c.projet !== suivi.nom ? c.projet : null });
    }

    return [...m.values()]
      .map((g) => ({ ...g, items: g.items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")) }))
      .sort((a, b) => (b.items[0]?.date ?? "").localeCompare(a.items[0]?.date ?? ""));
  }, [conclusions, etat]);

  const visibles = groupes
    .map((g) => ({ ...g, items: g.items.filter((c) => filtre(`${c.outil.nom} ${c.texte} ${g.nom}`)) }))
    .filter((g) => g.items.length);

  if (!visibles.length) return <RienASignaler>Aucune conclusion ne correspond.</RienASignaler>;

  return (
    <div className="space-y-7">
      {visibles.map((g) => (
        <section key={g.nom}>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <FolderOpen size={15} className="text-texte-3" strokeWidth={2} />
            <h2 className="t-h2">{g.nom}</h2>
            <span className="tabulaire rounded-full bg-fond-3 px-2 py-0.5 text-[11px] text-texte-3">
              {g.items.length}
            </span>
            {g.suivi?.banc && (
              <button
                onClick={() => aller({ vue: "projet", id: g.suivi.id, onglet: "essais" })}
                className="ml-auto flex items-center gap-1.5 text-[11px] text-texte-3 transition hover:text-texte"
              >
                voir son banc d'essai
                <ArrowRight size={12} strokeWidth={2} />
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-bord">
            {g.items.map((c, i) => (
              <LigneConclusion key={c.outil.cle + i} c={c} premier={i === 0} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LigneConclusion({ c, premier }) {
  return (
    <div className={`bg-fond-2 px-4 py-3.5 ${premier ? "" : "border-t border-bord"}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
        {c.simpleInstallation ? (
          <CircleDashed size={15} className="shrink-0 text-texte-3" strokeWidth={2} />
        ) : (
          <CircleCheck size={15} className="shrink-0 text-actif" strokeWidth={2} />
        )}
        <span className="text-[13.5px] font-medium text-texte">{c.outil.nom}</span>
        <span className="tabulaire text-[11px] text-texte-3">{c.date}</span>
        {c.libelleOrigine && (
          <span className="text-[11px] text-texte-3" title="Nom employé dans la fiche">
            « {c.libelleOrigine} »
          </span>
        )}
        <Jugement note={c.note} issue={c.issue} />
        {c.simpleInstallation && <Pastille ton="termine">Installation, pas d'essai</Pastille>}
        {c.outil.lienFiche && (
          <button
            onClick={() => ouvrir(c.outil.lienFiche.uri)}
            title="Ouvrir la fiche"
            className="ml-auto text-texte-3 transition hover:text-arbitrage"
          >
            <FileText size={13} strokeWidth={2} />
          </button>
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed text-texte-2">{c.texte}</p>
    </div>
  );
}

/** Vue historique, par outil : tous ses passages, tous projets confondus. */
function ParOutil({ outils, filtre }) {
  const visibles = outils
    .filter((o) => filtre([o.nom, o.tldr, ...(o.retours ?? []).map((r) => `${r.texte} ${r.projet ?? ""}`)].join(" ")))
    .sort((a, b) => {
      if (a.eprouve !== b.eprouve) return a.eprouve ? -1 : 1;
      return (b.retours?.[0]?.date ?? "").localeCompare(a.retours?.[0]?.date ?? "") || a.nom.localeCompare(b.nom);
    });

  if (!visibles.length) return <RienASignaler>Aucun outil ne correspond.</RienASignaler>;

  return (
    <div className="space-y-3">
      {visibles.map((o) => (
        <FicheEvaluation key={o.cle} o={o} />
      ))}
    </div>
  );
}

function FicheEvaluation({ o }) {
  const Icone = o.eprouve ? CircleCheck : o.statutDeclare === "a-tester" ? FlaskConical : CircleDashed;
  const ton = o.eprouve ? "actif" : o.statutDeclare === "a-tester" ? "pause" : "termine";

  return (
    <article className="monter rounded-xl border border-bord bg-fond-2 p-4">
      <header className="flex flex-wrap items-center gap-2.5">
        <Icone size={16} className={o.eprouve ? "text-actif" : "text-texte-3"} strokeWidth={2} />
        <span className="text-[14px] font-medium text-texte">{o.nom}</span>
        {o.type && <span className="text-[11px] text-texte-3">{o.type}</span>}
        <Pastille ton={ton}>{o.eprouve ? "Retour consigné" : "Jamais consigné"}</Pastille>
        <Pastille ton={TON_ETAT_OUTIL[o.etat] ?? "termine"}>{LIBELLE_ETAT_OUTIL[o.etat] ?? o.etat}</Pastille>
        {o.lienFiche && (
          <button
            onClick={() => ouvrir(o.lienFiche.uri)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-bord px-2.5 py-1 text-[11px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
          >
            <FileText size={12} strokeWidth={2} className="text-arbitrage" />
            Ouvrir la fiche
          </button>
        )}
      </header>

      {o.tldr && <p className="mt-2 text-[12.5px] leading-relaxed text-texte-2">{o.tldr}</p>}

      {o.eprouve ? (
        <ul className="mt-3 space-y-2.5 border-t border-bord pt-3">
          {o.retours.map((r, i) => (
            <li key={i} className="border-l-2 border-l-actif/50 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabulaire text-[11px] font-medium text-actif">{r.date}</span>
                {r.projet && <span className="text-[11px] text-texte-3">{r.projet}</span>}
                <Jugement note={r.note} issue={r.issue} />
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-texte-2">{r.texte}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-bord pt-3 text-[12px] leading-relaxed text-texte-3">
          Aucun retour consigné. Après usage sur un projet, ajouter une ligne{" "}
          <code className="rounded bg-fond-3 px-1 py-0.5">AAAA-MM · projet · ce qui a marché / raté</code> sous
          « Retours d'usage » dans sa fiche.
        </p>
      )}
    </article>
  );
}
