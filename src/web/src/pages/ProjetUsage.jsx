/**
 * Usage et avis : la structure du projet, puis ce que chaque outil y a fait.
 *
 * Trois sources croisées par le scanner, sans un token : l'historique des
 * sessions Claude Code (ce qui a servi, et pour quoi), le banc d'essai (ce qui
 * a été testé) et les fiches de la bibliothèque (ce qui a été évalué). La page
 * met en tête ce qui attend un retour de Lois ; le reste se lit ensuite.
 */
import React, { useState } from "react";
import {
  Hourglass, CheckCircle2, Archive, Hammer, MessageSquareQuote, FileText, Sparkles, Plug, Bot,
  Terminal, Workflow, Network, History, ChevronDown, Dot, Package,
} from "lucide-react";
import { Pastille, Section, Tuile } from "../components/primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { depuis, dateCourte } from "../lib/format.js";

export const EVALUATION = {
  "a-reporter": { libelle: "Conclusion à reporter", ton: "bloque", aide: "Testé au banc, verdict écrit dans le projet, absent de la fiche." },
  "a-evaluer": { libelle: "À évaluer", ton: "arbitrage", aide: "Utilisé ici, aucun retour d'usage pour ce projet dans sa fiche." },
  "fiche-manquante": { libelle: "Fiche à créer", ton: "pause", aide: "Utilisé ici, absent de la bibliothèque." },
  "note-manquante": { libelle: "Note manquante", ton: "arbitrage", aide: "Verdict posé dans la fiche (?/5), note à donner." },
  note: { libelle: "Noté", ton: "actif" },
  "retour-libre": { libelle: "Retour sans note", ton: "accent" },
  ponctuel: { libelle: "Usage ponctuel", ton: "termine" },
  maison: { libelle: "Fait maison", ton: "accent" },
};

const ACTIVITE = {
  recent: { libelle: "En usage", ton: "actif" },
  ancien: { libelle: "Plus utilisé", ton: "pause" },
  ecarte: { libelle: "Écarté", ton: "bloque" },
  "hors-historique": { libelle: "Avant l'historique", ton: "termine" },
  "en-place": { libelle: "Dans le code", ton: "actif" },
};

const ICONE_FAMILLE = { skill: Sparkles, mcp: Plug, agent: Bot, cli: Terminal, commande: Workflow, stack: Package };

export default function ProjetUsage({ p, allerOnglet }) {
  const b = p.bilan;
  const sujets = b?.sujets ?? [];
  const attente = sujets.filter((s) => s.attente);
  const evalues = sujets.filter((s) => ["note", "retour-libre", "note-manquante"].includes(s.evaluation) && !s.attente);
  // Index de ce qui ne sert plus, quel que soit son état d'évaluation : un outil
  // écarté peut encore attendre sa note, il doit apparaître dans les deux listes.
  const plusUtilises = sujets.filter((s) => s.activite === "ancien" || s.activite === "ecarte");
  const maison = sujets.filter((s) => s.evaluation === "maison");
  const ponctuels = sujets.filter((s) => s.evaluation === "ponctuel" && !plusUtilises.includes(s));

  return (
    <div className="space-y-9">
      <Structure p={p} allerOnglet={allerOnglet} />

      <Section
        titre="En attente de toi"
        compte={attente.length}
        icone={Hourglass}
        tonCompte="arbitrage"
        vide="Rien n'attend de retour : tout ce qui a servi ici est évalué."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {attente.map((s) => (
            <CarteSujet key={s.cle} s={s} />
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-texte-3">
          Pour transformer ces attentes en retours écrits (banc d'essai, fiches, bibliothèque), lance{" "}
          <code className="rounded bg-fond-3 px-1 py-0.5 text-[11px] text-texte-2">/bilan-outils {p.nom}</code> depuis
          Pilotoo. L'agent propose, tu valides, puis il écrit.
        </p>
      </Section>

      {evalues.length > 0 && (
        <Section titre="Évalués" compte={evalues.length} icone={CheckCircle2}>
          <div className="grid gap-3 lg:grid-cols-2">
            {evalues.map((s) => (
              <CarteSujet key={s.cle} s={s} />
            ))}
          </div>
        </Section>
      )}

      {plusUtilises.length > 0 && (
        <Section titre="Plus utilisés ou écartés" compte={plusUtilises.length} icone={Archive}>
          <ListeCompacte sujets={plusUtilises} avecEtat />
        </Section>
      )}

      {maison.length > 0 && (
        <Section titre="Agents et commandes du projet" compte={maison.length} icone={Hammer}>
          <ListeCompacte sujets={maison} />
          <button
            onClick={() => allerOnglet("agents")}
            className="mt-2 text-[12px] text-texte-3 underline-offset-2 transition hover:text-texte-2 hover:underline"
          >
            Identité et spécialité de chaque agent : onglet Agents
          </button>
        </Section>
      )}

      {ponctuels.length > 0 && (
        <Section titre="Usages ponctuels" compte={ponctuels.length} icone={Dot}>
          <p className="mb-2 text-[12px] text-texte-3">
            Un ou deux appels : trop peu pour réclamer une évaluation. Ils montent dans « En attente » s'ils reviennent.
          </p>
          <ListeCompacte sujets={ponctuels} />
        </Section>
      )}

      <Fenetre b={b} />
    </div>
  );
}

/** Le récapitulatif de structure : ce qui compose le projet, en une ligne de tuiles. */
function Structure({ p, allerOnglet }) {
  const o = p.outils ?? {};
  const a = p.agents?.resume ?? {};
  const skills = o.skills ?? [];
  const dormants = skills.filter((s) => s.etat === "dormant").length;
  const mcpActifs = (o.mcp ?? []).filter((m) => m.etat === "actif").length;
  const r = p.bilan?.resume ?? {};

  return (
    <section className="monter">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-vert-pale text-vert" aria-hidden="true">
          <Network size={18} strokeWidth={2.2} />
        </span>
        <h2 className="t-h2">Structure du projet</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tuile
          libelle="Méthode"
          valeur={<span className="block break-words pt-1 text-[17px] leading-snug">{p.methode?.libelle ?? "-"}</span>}
          detail={p.methode?.source === "déduite" ? "déduite des fichiers" : p.methode ? "déclarée" : "aucune reconnue"}
        />
        <Tuile
          libelle="Skills embarqués"
          valeur={skills.length}
          detail={skills.length ? `${dormants} dormant${dormants > 1 ? "s" : ""}` : "aucun"}
        />
        <Tuile libelle="MCP du projet" valeur={(o.mcp ?? []).length} detail={`${mcpActifs} actif${mcpActifs > 1 ? "s" : ""}`} />
        <Tuile
          libelle="Agents"
          valeur={a.agents ?? 0}
          detail={a.commandes ? `${a.commandes} commande${a.commandes > 1 ? "s" : ""}` : "aucune commande"}
          ton={a.agents ? "accent" : "termine"}
        />
        <Tuile
          libelle="Hooks · graphe"
          valeur={(o.hooks ?? []).length}
          detail={o.graphe?.noeuds ? `graphe de ${o.graphe.noeuds} nœuds` : "pas de graphe"}
        />
        <Tuile
          libelle="Retours attendus"
          valeur={r.attente ?? 0}
          detail={r.attente ? `${r.notes ?? 0} outil${(r.notes ?? 0) > 1 ? "s" : ""} noté${(r.notes ?? 0) > 1 ? "s" : ""}` : "rien en attente"}
          ton={r.attente ? "arbitrage" : "actif"}
        />
      </div>
      <div className="mt-2 flex gap-3 text-[12px] text-texte-3">
        <button onClick={() => allerOnglet("outils")} className="transition hover:text-texte-2">
          Détail des outils →
        </button>
        <button onClick={() => allerOnglet("agents")} className="transition hover:text-texte-2">
          Détail des agents →
        </button>
      </div>
    </section>
  );
}

function CarteSujet({ s }) {
  const ev = EVALUATION[s.evaluation] ?? EVALUATION.ponctuel;
  const act = ACTIVITE[s.activite];
  const [plus, setPlus] = useState(false);
  const contextes = plus ? s.contextes : s.contextes.slice(0, 2);
  const retoursEval = s.retours.filter((r) => !r.installation);

  return (
    <article className="flex flex-col rounded-xl border border-bord bg-fond-2 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="t-h3">{s.nom}</h3>
        <Pastille ton={ev.ton}>{ev.libelle}</Pastille>
        {act && s.activite !== "recent" && <Pastille ton={act.ton}>{act.libelle}</Pastille>}
        {s.note != null && (
          <span className="tabulaire text-[13px] font-semibold text-actif" title="Note sur 5">
            {s.note}/5
          </span>
        )}
        {s.fiche?.lien && (
          <button
            onClick={() => ouvrir(s.fiche.lien.uri)}
            title="Ouvrir la fiche dans la bibliothèque"
            aria-label={`Ouvrir la fiche ${s.fiche.nom}`}
            className="ml-auto text-texte-3 transition hover:text-arbitrage"
          >
            <FileText size={14} strokeWidth={2} />
          </button>
        )}
      </header>
      {ev.aide && s.attente && <p className="mt-1 text-[11.5px] text-texte-3">{ev.aide}</p>}

      {s.composants.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {s.composants.map((c) => {
            const I = ICONE_FAMILLE[c.famille] ?? Dot;
            return (
              <span
                key={c.famille + c.nom}
                title={c.lisible ? `/${c.nom}` : undefined}
                className={`inline-flex items-center gap-1 rounded-md bg-fond-3 px-1.5 py-0.5 text-[11px] text-texte-2 ${c.lisible ? "" : "font-mono"}`}
              >
                <I size={11} strokeWidth={2} aria-hidden="true" />
                {c.lisible ?? c.nom}
                {c.appels > 0 && <span className="tabulaire text-texte-3">×{c.appels}</span>}
              </span>
            );
          })}
          {s.au && (
            <span className="text-[11px] text-texte-3">
              {s.du && dateCourte(s.du) !== dateCourte(s.au) ? `du ${dateCourte(s.du)} au ${dateCourte(s.au)}` : dateCourte(s.au)}
            </span>
          )}
        </div>
      )}

      {s.avis.length > 0 && (
        <Bloc titre="Ce que tu en as dit" icone={MessageSquareQuote}>
          {s.avis.map((a, i) => (
            <blockquote key={i} className="border-l-2 border-arbitrage/60 pl-3 text-[12.5px] leading-relaxed text-texte">
              « {a.texte} »<span className="ml-1.5 text-[11px] text-texte-3">{dateCourte(a.date)}</span>
            </blockquote>
          ))}
        </Bloc>
      )}

      {(contextes.length > 0 || s.essai?.surQuoi) && (
        <Bloc titre="À quoi ça a servi" icone={History}>
          {s.essai?.surQuoi && (
            <p className="text-[12px] leading-relaxed text-texte-2">
              <span className="tabulaire mr-1.5 text-texte-3">{s.essai.date}</span>Banc d'essai : {s.essai.surQuoi}
            </p>
          )}
          {contextes.map((c, i) => (
            <p key={i} className="line-clamp-2 text-[12px] leading-relaxed text-texte-2">
              <span className="tabulaire mr-1.5 text-texte-3">{dateCourte(c.date)}</span>
              {c.texte}
            </p>
          ))}
          {s.contextes.length > 2 && (
            <button
              onClick={() => setPlus((v) => !v)}
              aria-expanded={plus}
              className="flex items-center gap-1 text-[11.5px] text-texte-3 transition hover:text-texte-2"
            >
              <ChevronDown size={12} className={plus ? "rotate-180" : ""} /> {plus ? "Moins" : `${s.contextes.length - 2} de plus`}
            </button>
          )}
        </Bloc>
      )}

      {retoursEval.length > 0 && (
        <Bloc titre="Retour dans la fiche" icone={CheckCircle2}>
          {retoursEval.map((r, i) => (
            <p key={i} className="line-clamp-3 text-[12px] leading-relaxed text-texte-2">
              <span className="tabulaire mr-1.5 text-texte-3">{r.date}</span>
              {r.issue && <span className="mr-1.5 text-texte">{r.issue}</span>}
              {r.texte}
            </p>
          ))}
        </Bloc>
      )}
    </article>
  );
}

function ListeCompacte({ sujets, avecEtat = false }) {
  return (
    <div className="overflow-hidden rounded-xl border border-bord">
      {sujets.map((s, i) => (
        <div key={s.cle} className={`flex flex-wrap items-center gap-2.5 bg-fond-2 px-4 py-2.5 ${i ? "border-t border-bord" : ""}`}>
          <span className="text-[13px] text-texte">{s.nom}</span>
          {avecEtat && ACTIVITE[s.activite] && <Pastille ton={ACTIVITE[s.activite].ton}>{ACTIVITE[s.activite].libelle}</Pastille>}
          {avecEtat && s.attente && <Pastille ton={EVALUATION[s.evaluation].ton}>{EVALUATION[s.evaluation].libelle}</Pastille>}
          <span className="tabulaire text-[11px] text-texte-3">
            {s.appels} appel{s.appels > 1 ? "s" : ""}
            {s.au ? ` · ${dateCourte(s.au)}` : ""}
          </span>
          {/* Le premier appel dit pourquoi l'outil est entré dans le projet. */}
          {s.contextes.length > 0 && (
            <span className="min-w-0 flex-1 truncate text-[12px] text-texte-3" title={s.contextes.at(-1).texte}>
              {avecEtat && "Servi à : "}
              {s.contextes.at(-1).texte}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Bloc({ titre, icone: Icone, children }) {
  return (
    <div className="mt-3">
      <div className="t-label mb-1.5 flex items-center gap-1.5">
        {Icone && <Icone size={12} strokeWidth={2.4} aria-hidden="true" />}
        {titre}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Fenetre({ b }) {
  const f = b?.fenetre;
  return (
    <div className="rounded-xl border border-bord bg-fond-2 p-4 text-[12.5px] leading-relaxed text-texte-3">
      <p>
        Usage relevé dans l'historique des sessions Claude Code
        {f?.sessions ? (
          <>
            {" "}: <strong className="text-texte-2">{f.sessions} session{f.sessions > 1 ? "s" : ""}</strong>
            {f.du && ` du ${dateCourte(f.du)} au ${dateCourte(f.au)}`}
            {f.purgees ? `, dont ${f.purgees} purgée${f.purgees > 1 ? "s" : ""} par Claude Code et gardée${f.purgees > 1 ? "s" : ""} par Pilotoo` : ""}.
          </>
        ) : (
          " : aucune session trouvée pour ce dossier."
        )}{" "}
        Claude Code efface ses sessions au bout de 30 jours ; Pilotoo en garde l'extrait à partir de son premier scan.
        Ce qui précède n'apparaît que par le banc d'essai et les fiches (« Avant l'historique »).
      </p>
      {f?.au && <p className="mt-1">Dernier appel relevé {depuis(f.au)}.</p>}
    </div>
  );
}
