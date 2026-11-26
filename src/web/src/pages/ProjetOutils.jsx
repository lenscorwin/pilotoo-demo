/**
 * Outils d'un projet : ce qui est branché *ici*, par opposition au catalogue
 * transverse de la page Outils.
 *
 * La nuance que la page doit rendre lisible : posé n'est pas actif. Un serveur
 * MCP déclaré attend une approbation, un skill en mode dormant ne se déclenche
 * jamais seul. Trois états, jamais distingués par la seule couleur.
 */
import React from "react";
import SkillsParPack from "../components/SkillsParPack.jsx";
import { Plug, Sparkles, Webhook, Network, Package, ShieldCheck, ArrowRight, FileText } from "lucide-react";
import { Pastille, Section } from "../components/primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { depuis } from "../lib/format.js";

const LIBELLE_ETAT = {
  actif: "Actif",
  dormant: "Dormant",
  "non-approuve": "En attente d'approbation",
  "installe-non-construit": "Installé, graphe non construit",
};

const TON_ETAT = {
  actif: "actif",
  dormant: "pause",
  "non-approuve": "arbitrage",
  "installe-non-construit": "pause",
};

export default function ProjetOutils({ p, aller }) {
  const o = p.outils;

  if (!o || o.resume.total === 0) {
    return (
      <div className="rounded-xl border border-bord bg-fond-2 p-6">
        <p className="text-[14px] leading-relaxed text-texte-2">
          Aucun outil n'est branché sur ce projet en propre : ni serveur MCP local, ni skill embarqué, ni hook, ni
          graphe Graphify.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-texte-3">
          Les outils du catalogue restent disponibles ici : ils sont installés au niveau de ton compte, donc actifs
          dans n'importe quel dossier.
        </p>
        <LienCatalogue aller={aller} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Pastille ton="actif">{o.resume.actifs} actifs</Pastille>
        {o.resume.dormants > 0 && <Pastille ton="pause">{o.resume.dormants} dormants</Pastille>}
        {o.resume.enAttente > 0 && <Pastille ton="arbitrage">{o.resume.enAttente} en attente</Pastille>}
      </div>

      {o.mcp.length > 0 && (
        <Section titre="Serveurs MCP du projet" compte={o.mcp.length} icone={Plug}>
          <div className="overflow-hidden rounded-xl border border-bord">
            {o.mcp.map((m, i) => (
              <Ligne key={m.nom + i} premier={i === 0} nom={m.nom} etat={m.etat} source={m.source} lien={m.catalogue?.lienFiche}>
                {m.commande && <Code>{m.commande}</Code>}
                {m.note && <p className="mt-2 text-[12px] leading-relaxed text-texte-2">{m.note}</p>}
                {m.catalogue?.tldr && <p className="mt-2 text-[12px] leading-relaxed text-texte-3">{m.catalogue.tldr}</p>}
                {m.etat === "non-approuve" && (
                  <p className="mt-2 text-[12px] leading-relaxed text-arbitrage">
                    Déclaré dans <code>{m.source}</code> mais absent de <code>enabledMcpjsonServers</code> : Claude ne
                    le chargera pas tant qu'il n'est pas approuvé.
                  </p>
                )}
                {m.etat === "dormant" && (
                  <p className="mt-2 text-[12px] leading-relaxed text-pause">
                    Fichier <code>mcp.json</code> sans point : bloc posé volontairement inactif. Le renommer en{" "}
                    <code>.mcp.json</code> l'active.
                  </p>
                )}
              </Ligne>
            ))}
          </div>
        </Section>
      )}

      {o.skills.length > 0 && <ListeSkills p={p} skills={o.skills} />}

      {o.graphe && (
        <Section titre="Graphe Graphify" icone={Network}>
          <div className="rounded-xl border border-bord bg-fond-2 p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <Pastille ton={TON_ETAT[o.graphe.etat]}>{LIBELLE_ETAT[o.graphe.etat]}</Pastille>
              {o.graphe.noeuds != null && (
                <span className="tabulaire text-[12px] text-texte-3">{o.graphe.noeuds} nœuds</span>
              )}
            </div>
            <p className="text-[12px] leading-relaxed text-texte-3">
              {o.graphe.construit
                ? `Dernière construction ${depuis(o.graphe.construit)}. Rebuild : graphify ./src --update`
                : "Le dossier graphify-out/ existe mais ne contient pas de graphe. Premier build : /graphify ./src --obsidian"}
            </p>
          </div>
        </Section>
      )}

      {o.hooks.length > 0 && (
        <Section titre="Hooks" compte={o.hooks.length} icone={Webhook}>
          <div className="overflow-hidden rounded-xl border border-bord">
            {o.hooks.map((h, i) => (
              <div key={i} className={`bg-fond-2 px-4 py-3 ${i === 0 ? "" : "border-t border-bord"}`}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Pastille ton="accent">{h.evenement}</Pastille>
                  <span className="text-[13px] text-texte">{h.libelle}</span>
                  <span className="ml-auto font-mono text-[11px] text-texte-3">{h.source}</span>
                </div>
                <Code>{h.commande}</Code>
              </div>
            ))}
          </div>
        </Section>
      )}

      {o.stack.length > 0 && (
        <Section titre="Outils de la stack" compte={o.stack.length} icone={Package}>
          <div className="overflow-hidden rounded-xl border border-bord">
            {o.stack.map((s, i) => (
              <Ligne key={s.nom} premier={i === 0} nom={s.nom} etat="actif" source={s.source} version={s.version} lien={s.catalogue?.lienFiche}>
                {s.catalogue?.tldr && <p className="text-[12px] leading-relaxed text-texte-3">{s.catalogue.tldr}</p>}
              </Ligne>
            ))}
          </div>
        </Section>
      )}

      {o.permissions.length > 0 && (
        <Section titre="Permissions accordées localement" compte={o.permissions.length} icone={ShieldCheck}>
          <div className="flex flex-wrap gap-2">
            {o.permissions.map((perm) => (
              <code key={perm} className="rounded bg-fond-3 px-2 py-1 font-mono text-[11px] text-texte-2">
                {perm}
              </code>
            ))}
          </div>
        </Section>
      )}

      <div className="rounded-xl border border-bord bg-fond-2 p-4">
        <p className="text-[12.5px] leading-relaxed text-texte-3">
          Cette page ne montre que ce qui est branché <strong className="text-texte-2">sur ce projet</strong>. Les
          outils installés au niveau de ton compte (skills, plugins, serveurs MCP globaux, binaires) restent
          disponibles ici sans y figurer.
        </p>
        <LienCatalogue aller={aller} />
      </div>
    </div>
  );
}

/**
 * Skills embarqués : rangés par pack, nom et rôle visibles, détail replié.
 * L'explication du mode dormant est donnée une fois pour toute la section.
 */
function ListeSkills({ p, skills }) {
  const dormants = skills.filter((s) => s.etat === "dormant").length;
  // Ce que chaque skill a fait sur ce projet, d'après l'historique des sessions.
  const usage = Object.fromEntries(
    (p.usage?.outils ?? [])
      .filter((o) => o.famille === "skill")
      .map((o) => [o.nom, { appels: o.appels, au: o.au, contexte: o.contextes?.[0]?.texte ?? null }])
  );

  return (
    <Section titre="Skills embarqués" compte={skills.length} icone={Sparkles}>
      {dormants > 0 && (
        <p className="mb-3 text-[12px] leading-relaxed text-texte-3">
          <strong className="font-semibold text-pause">
            {dormants === skills.length ? "Tous dormants." : `${dormants} dormants.`}
          </strong>{" "}
          Un skill dormant (<code className="text-[11px]">disable-model-invocation: true</code>) ne part que si tu tapes sa
          commande : on peut en installer cinquante sans qu'ils se contredisent.
        </p>
      )}
      <SkillsParPack packs={p.outils.packsSkills ?? []} usage={usage} />
    </Section>
  );
}

function LienCatalogue({ aller }) {
  return (
    <button
      onClick={() => aller({ vue: "outils" })}
      className="mt-3 flex items-center gap-2 rounded-lg border border-bord px-3 py-2 text-[12px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
    >
      Voir le catalogue transverse
      <ArrowRight size={13} strokeWidth={2} />
    </button>
  );
}

function Ligne({ premier, nom, etat, source, version, lien, children }) {
  return (
    <div className={`bg-fond-2 px-4 py-3.5 ${premier ? "" : "border-t border-bord"}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
        <span className="text-[14px] font-medium text-texte">{nom}</span>
        {version && <span className="tabulaire text-[11px] text-texte-3">v{version}</span>}
        <Pastille ton={TON_ETAT[etat] ?? "termine"}>{LIBELLE_ETAT[etat] ?? etat}</Pastille>
        <span className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] text-texte-3">{source}</span>
          {lien && (
            <button
              onClick={() => ouvrir(lien.uri)}
              title="Ouvrir la fiche"
              className="text-texte-3 transition hover:text-arbitrage"
            >
              <FileText size={13} strokeWidth={2} />
            </button>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

function Code({ children }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-fond px-3 py-2 font-mono text-[11px] leading-relaxed text-texte-3">
      {children}
    </pre>
  );
}
