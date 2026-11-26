/**
 * Agents d'un projet : qui travaille ici, sur quoi, avec quels droits.
 *
 * Une carte par agent, tirée de son fichier `.claude/agents/<nom>.md` :
 * l'identité (le « Tu es… » du prompt), la spécialité (la `description:` que
 * Claude lit pour décider de l'appeler) et le périmètre d'accès déduit de
 * `tools:`. Les commandes qui enchaînent ces agents passent en tête, parce
 * qu'elles disent dans quel ordre ils interviennent.
 */
import React from "react";
import { Bot, Workflow, FileText, ArrowRight, Plug } from "lucide-react";
import { Pastille, Section } from "../components/primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { depuis, dateCourte } from "../lib/format.js";

/** Le périmètre d'accès, toujours écrit en clair à côté de sa couleur. */
const ACCES = {
  lecture: { libelle: "Lecture seule", ton: "actif" },
  ecrit: { libelle: "Lit et écrit des fichiers", ton: "accent" },
  execute: { libelle: "Exécute des commandes", ton: "arbitrage" },
  tout: { libelle: "Tous les outils", ton: "pause" },
};

const TUILE = {
  actif: "border-actif/35 bg-actif/10 text-actif",
  accent: "border-accent/35 bg-accent/10 text-accent",
  arbitrage: "border-arbitrage/35 bg-arbitrage/10 text-arbitrage",
  pause: "border-pause/35 bg-pause/10 text-pause",
};

export default function ProjetAgents({ p }) {
  const a = p.agents;

  if (!a || (a.resume.agents === 0 && a.resume.commandes === 0)) {
    return (
      <div className="rounded-xl border border-bord bg-fond-2 p-6">
        <p className="text-[14px] leading-relaxed text-texte-2">Aucun agent n'est défini pour ce projet.</p>
        <p className="mt-3 text-[13px] leading-relaxed text-texte-3">
          Un agent se déclare dans <Code>.claude/agents/&lt;nom&gt;.md</Code>, une commande qui les enchaîne dans{" "}
          <Code>.claude/commands/</Code>. Ils apparaissent ici au scan suivant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {a.commandes.length > 0 && (
        <Section titre="Orchestration" compte={a.commandes.length} icone={Workflow}>
          <div className="space-y-3">
            {a.commandes.map((c) => (
              <Commande key={c.nom} c={c} />
            ))}
          </div>
        </Section>
      )}

      {a.agents.length > 0 && (
        <Section titre="Agents du projet" compte={a.agents.length} icone={Bot}>
          <div className="grid gap-4 lg:grid-cols-2">
            {a.agents.map((ag) => (
              <CarteAgent key={ag.nom} ag={ag} />
            ))}
          </div>
        </Section>
      )}

      <div className="rounded-xl border border-bord bg-fond-2 p-4">
        <p className="text-[12.5px] leading-relaxed text-texte-3">
          Identité et spécialité sont lues dans le fichier de chaque agent, sans interprétation. Pour en changer, on
          modifie le <Code>.md</Code> de l'agent ; le dashboard suit au scan suivant.
        </p>
      </div>
    </div>
  );
}

function Commande({ c }) {
  return (
    <div className="rounded-xl border border-bord bg-fond-2 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[14px] font-medium text-texte">{c.nom}</span>
        {c.arguments && <span className="font-mono text-[11px] text-texte-3">{c.arguments}</span>}
        <Usage u={c.usage} />
        <BoutonFiche lien={c.lien} fichier={c.fichier} />
      </div>
      {c.description && <p className="mt-2 text-[12.5px] leading-relaxed text-texte-2">{c.description}</p>}
      {c.agents.length > 0 && (
        <ol className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Ordre d'intervention des agents">
          {c.agents.map((nom, i) => (
            <li key={nom} className="flex items-center gap-1.5">
              {i > 0 && <ArrowRight size={12} strokeWidth={2} className="text-texte-3" aria-hidden="true" />}
              <span className="rounded-md bg-fond-3 px-2 py-0.5 font-mono text-[11px] text-texte-2">
                <span className="tabulaire mr-1.5 text-texte-3">{i + 1}</span>
                {nom}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CarteAgent({ ag }) {
  const acces = ACCES[ag.acces] ?? ACCES.tout;
  return (
    <article className="flex flex-col rounded-xl border border-bord bg-fond-2 p-4">
      <header className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-mono text-[12px] font-semibold uppercase ${TUILE[acces.ton]}`}
          aria-hidden="true"
        >
          {initiales(ag.nom)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-mono text-[14px] font-medium text-texte">{ag.nom}</h3>
          <p className="t-h3 mt-0.5 text-[15px] text-texte-2">{ag.role ?? "Rôle non nommé dans le prompt"}</p>
        </div>
        <BoutonFiche lien={ag.lien} fichier={ag.fichier} />
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pastille ton={acces.ton}>{acces.libelle}</Pastille>
        {ag.modele && ag.modele !== "inherit" && <Pastille>Modèle {ag.modele}</Pastille>}
        <Usage u={ag.usage} />
        {ag.appelePar.map((c) => (
          <Pastille key={c} ton="accent">
            <Workflow size={11} strokeWidth={2.4} />
            {c}
          </Pastille>
        ))}
      </div>

      {ag.specialite && (
        <Bloc titre="Spécialité">
          <p className="text-[12.5px] leading-relaxed text-texte-2">{ag.specialite}</p>
        </Bloc>
      )}

      {ag.identite && (
        <Bloc titre="Identité">
          <blockquote className="line-clamp-4 border-l-2 border-vert pl-3 text-[12px] italic leading-relaxed text-texte-3">
            {ag.identite}
          </blockquote>
        </Bloc>
      )}

      <Bloc titre="Outils autorisés">
        {ag.outils ? (
          <div className="flex flex-wrap gap-1">
            {ag.outils.map((t) => (
              <code key={t} className="rounded bg-fond-3 px-1.5 py-0.5 font-mono text-[11px] text-texte-2">
                {t}
              </code>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-texte-3">
            Pas de <Code>tools:</Code> dans le frontmatter : l'agent hérite de tous les outils de la session.
          </p>
        )}
        {ag.mcp.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-texte-3">
            <Plug size={12} strokeWidth={2} aria-hidden="true" />
            MCP sollicité :
            {ag.mcp.map((m) => (
              <code key={m} className="rounded bg-fond-3 px-1.5 py-0.5 font-mono text-texte-2">
                {m}
              </code>
            ))}
          </div>
        )}
      </Bloc>

      {ag.sections.length > 0 && (
        <Bloc titre="Charpente du prompt">
          <p className="text-[11.5px] leading-relaxed text-texte-3">{ag.sections.join(" · ")}</p>
        </Bloc>
      )}

      <footer className="mt-auto pt-3 font-mono text-[10.5px] text-texte-3">
        {ag.fichier}
        {ag.majLe && <span className="font-sans"> · modifié {depuis(ag.majLe)}</span>}
      </footer>
    </article>
  );
}

/**
 * Combien de fois l'agent a servi, d'après l'historique des sessions. Un agent
 * jamais lancé n'est pas une erreur, mais c'est une information : il a peut-être
 * été écrit pour un chantier qui a changé de cap.
 */
function Usage({ u }) {
  if (!u) return <Pastille>Jamais lancé dans l'historique</Pastille>;
  return (
    <Pastille ton="actif">
      {u.appels} lancement{u.appels > 1 ? "s" : ""} · {dateCourte(u.au)}
    </Pastille>
  );
}

function Bloc({ titre, children }) {
  return (
    <div className="mt-3.5">
      <div className="t-label mb-1.5">{titre}</div>
      {children}
    </div>
  );
}

function BoutonFiche({ lien, fichier }) {
  if (!lien) return null;
  return (
    <button
      onClick={() => ouvrir(lien.uri)}
      title={`Ouvrir ${fichier}`}
      aria-label={`Ouvrir ${fichier}`}
      className="ml-auto shrink-0 text-texte-3 transition hover:text-arbitrage"
    >
      <FileText size={14} strokeWidth={2} />
    </button>
  );
}

function Code({ children }) {
  return <code className="rounded bg-fond-3 px-1 py-0.5 text-[11.5px]">{children}</code>;
}

/** `motion-directeur` → « MD », `cv-da-controleur` → « CDC ». */
function initiales(nom) {
  return String(nom)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((m) => m[0])
    .join("");
}
