/**
 * Banc d'essai d'un projet : les outils évalués *ici*.
 *
 * Un essai reste dans le projet qui l'a mené, parce que le contexte fait
 * partie du résultat. Cette page montre donc l'évaluation locale, et une
 * seule information de plus, celle qui manquait : la conclusion a-t-elle
 * rejoint l'archive de « Skills-Lib » ?
 */
import React, { useState } from "react";
import { FlaskConical, FileText, Archive, ArchiveX, Star, ExternalLink, CircleDashed } from "lucide-react";
import { Pastille, Section } from "../components/primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { dateCourte } from "../lib/format.js";

const LIBELLE_ISSUE = { retenu: "Retenu", ecarte: "Écarté", "a-revoir": "À revoir", "sans-verdict": "Sans verdict" };
const TON_ISSUE = { retenu: "actif", ecarte: "bloque", "a-revoir": "pause", "sans-verdict": "termine" };

const NON_TESTES_VISIBLES = 10;

export default function ProjetEssais({ p }) {
  const [tout, setTout] = useState(false);
  const b = p.banc;
  const testes = b.essais.filter((e) => e.teste);
  const nonTestes = b.essais.filter((e) => !e.teste);
  const visibles = tout ? nonTestes : nonTestes.slice(0, NON_TESTES_VISIBLES);

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-bord bg-fond-2 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Pastille ton="accent">
            <FlaskConical size={11} strokeWidth={2.4} />
            {b.resume.total} outils au banc
          </Pastille>
          <Pastille ton={testes.length ? "actif" : "termine"}>{testes.length} testés</Pastille>
          <Pastille ton="termine">{nonTestes.length} en attente d'essai</Pastille>
          <Pastille ton={b.resume.aReporter ? "bloque" : "actif"}>
            {b.resume.aReporter ? `${b.resume.aReporter} à reporter` : "tout est reporté"}
          </Pastille>
        </div>
        <p className="text-[12.5px] leading-relaxed text-texte-2">
          Les essais vivent ici, dans le projet où ils ont été menés : le même outil peut gagner sur un projet et
          perdre sur un autre. Seule la conclusion part à l'archive, dans la fiche de l'outil chez « Skills-Lib ».
        </p>
        <button
          onClick={() => ouvrir(b.lien?.uri)}
          className="mt-3 flex items-center gap-2 rounded-lg border border-bord px-3 py-1.5 text-[12px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
        >
          <ExternalLink size={12} strokeWidth={2} className="text-arbitrage" />
          Ouvrir le banc d'essai
          {b.misAJour && <span className="text-texte-3">· màj {dateCourte(b.misAJour)}</span>}
        </button>
      </header>

      <Section
        titre="Testés sur ce projet"
        compte={testes.length}
        icone={FlaskConical}
        tonCompte="actif"
        vide="Aucun essai mené pour l'instant."
      >
        <div className="space-y-3">
          {testes.map((e) => (
            <Essai key={e.cle} e={e} />
          ))}
        </div>
      </Section>

      <Section titre="En attente d'essai" compte={nonTestes.length} icone={CircleDashed}>
        <div className="overflow-hidden rounded-xl border border-bord">
          {visibles.map((e, i) => (
            <div
              key={e.cle + i}
              className={`flex items-center gap-3 bg-fond-2 px-4 py-2.5 ${i === 0 ? "" : "border-t border-bord"}`}
            >
              <CircleDashed size={14} className="shrink-0 text-texte-3" strokeWidth={2} />
              <span className="text-[13px] text-texte-2">{e.nom}</span>
              {!e.aUneFiche && (
                <span className="ml-auto text-[11px] text-texte-3">pas de fiche au catalogue</span>
              )}
            </div>
          ))}
        </div>
        {nonTestes.length > NON_TESTES_VISIBLES && (
          <button
            onClick={() => setTout(!tout)}
            className="mt-3 w-full rounded-lg border border-bord bg-fond-2 py-2 text-[12px] font-medium text-texte-2 transition hover:border-bord-vif hover:text-texte"
          >
            {tout ? "Replier" : `Afficher les ${nonTestes.length - NON_TESTES_VISIBLES} autres`}
          </button>
        )}
      </Section>
    </div>
  );
}

function Essai({ e }) {
  return (
    <article
      className={`monter rounded-xl border bg-fond-2 p-4 ${
        e.aReporter ? "border-bloque/35" : "border-bord"
      }`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2.5">
        <span className="text-[14px] font-medium text-texte">{e.nom}</span>
        <span className="tabulaire text-[11px] text-texte-3">{e.date}</span>
        {e.issue && <Pastille ton={TON_ISSUE[e.issue]}>{LIBELLE_ISSUE[e.issue] ?? e.issue}</Pastille>}
        {e.note != null && (
          <Pastille ton="accent">
            <Star size={10} strokeWidth={2.6} />
            {e.note}/5
          </Pastille>
        )}
        <Pastille ton={e.reporte ? "actif" : "bloque"} className="ml-auto">
          {e.reporte ? <Archive size={11} strokeWidth={2.4} /> : <ArchiveX size={11} strokeWidth={2.4} />}
          {e.reporte ? "Reporté à l'archive" : "Pas encore reporté"}
        </Pastille>
      </header>

      {e.surQuoi && (
        <p className="text-[12.5px] leading-relaxed text-texte-3">
          <span className="text-texte-2">Sur quoi : </span>
          {e.surQuoi}
        </p>
      )}
      {e.verdict && <p className="mt-1.5 text-[12.5px] leading-relaxed text-texte-2">{e.verdict}</p>}

      {e.aReporter && (
        <p className="mt-2.5 border-t border-bord pt-2.5 text-[12px] leading-relaxed text-bloque">
          {e.aUneFiche
            ? "Conclusion jamais reportée : la fiche de cet outil ne porte aucun retour pour ce projet."
            : "Aucune fiche à son nom au catalogue : la conclusion n'a nulle part où aller. Fiche à créer."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {e.lien && (
          <button
            onClick={() => ouvrir(e.lien.uri)}
            className="flex items-center gap-1.5 rounded-lg border border-bord px-2.5 py-1 text-[11px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
          >
            <FileText size={12} strokeWidth={2} className="text-arbitrage" />
            Verdict détaillé
          </button>
        )}
        {e.lienFiche && (
          <button
            onClick={() => ouvrir(e.lienFiche.uri)}
            className="flex items-center gap-1.5 rounded-lg border border-bord px-2.5 py-1 text-[11px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
          >
            <Archive size={12} strokeWidth={2} className="text-arbitrage" />
            Fiche au catalogue
          </button>
        )}
      </div>
    </article>
  );
}
