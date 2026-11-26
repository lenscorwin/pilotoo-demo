/**
 * Vue projet : le résumé, l'historique des sessions, les étapes à venir,
 * les arbitrages et la vigilance, plus les liens d'ouverture.
 *
 * La page est en lecture seule par construction. Pour modifier quoi que ce
 * soit, y compris cocher une étape, on ouvre la note dans Obsidian, un seul
 * éditeur, pas de conflit.
 */
import React from "react";
import {
  History, ListTodo, Scale, ShieldAlert, FolderOpen, FileText,
  ExternalLink, GitBranch, GitCommitHorizontal, HardDrive, CalendarClock, Info,
  ClipboardList, Wrench, Gauge, Layers, FlaskConical, Network, Bot, Activity, GitFork, FolderTree,
} from "lucide-react";
import ProjetOutils from "./ProjetOutils.jsx";
import ProjetEvaluation from "./ProjetEvaluation.jsx";
import ProjetEssais from "./ProjetEssais.jsx";
import ProjetAgents from "./ProjetAgents.jsx";
import ProjetUsage from "./ProjetUsage.jsx";
import { GrapheBranches, RythmeCommits } from "../components/SchemasGit.jsx";
import { Pastille, Jauge, Section, Puces, BoutonCopier } from "../components/primitives.jsx";
import { useProgression, BlocProgression, ChecklistEtapes } from "../components/Progression.jsx";
import { ouvrir } from "../lib/api.js";
import { iconeProjet, TUILE_TON } from "../lib/icones.js";
import {
  LIBELLE_STATUT, TON_STATUT, TON_ALERTE, depuis, dateCourte, octetsLisibles,
  tonMethode, titreMethode,
} from "../lib/format.js";

export default function Projet({ p, etat, onglet, allerOnglet, aller }) {
  const ton = TON_STATUT[p.statut] ?? "termine";
  // L'en-tête et la liste partagent le même rejeu : l'anneau avance au moment
  // où les étapes cochées depuis la dernière visite se cochent dans la liste.
  const clotures = useProgression(p);
  const Icone = iconeProjet(p);

  // L'onglet d'évaluation n'existe que pour le projet qui héberge les fiches :
  // c'est lui qui détient les retours d'usage, personne d'autre.
  const onglets = [
    { cle: "suivi", libelle: "Suivi", icone: ClipboardList },
    { cle: "outils", libelle: "Outils du projet", icone: Wrench, compte: p.outils?.resume?.total ?? 0 },
    { cle: "agents", libelle: "Agents", icone: Bot, compte: p.agents?.resume?.agents ?? 0 },
    // Usage relevé dans les sessions, croisé avec banc et fiches. Le point
    // signale ce qui attend un retour de Lois.
    {
      cle: "usage",
      libelle: "Usage & avis",
      icone: Activity,
      compte: p.bilan?.resume?.total ?? 0,
      attente: p.bilan?.resume?.attente ?? 0,
    },
    // L'onglet Essais n'apparaît que sur un projet qui sert de terrain d'essai,
    // c'est-à-dire qui déclare un banc dans config/targets.json.
    ...(p.banc
      ? [{ cle: "essais", libelle: "Essais menés ici", icone: FlaskConical, compte: p.banc.resume.testes, alerte: p.banc.resume.aReporter }]
      : []),
    ...(p.estCatalogue ? [{ cle: "evaluation", libelle: "Archive des conclusions", icone: Gauge }] : []),
  ];
  const actif = onglets.some((o) => o.cle === onglet) ? onglet : "suivi";

  return (
    <div className="page-projet mx-auto max-w-[1200px] px-8 py-8">
      {/* L'en-tête en bleu profond : c'est l'identité du projet, ce qu'on doit
          reconnaître avant de lire. Le reste de la page reste en clair. */}
      <header className="nuit mb-7 rounded-3xl px-8 py-7 shadow-haute">
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <Pastille ton={ton}>{LIBELLE_STATUT[p.statut] ?? p.statut}</Pastille>
          {p.methode && (
            <span title={titreMethode(p.methode)}>
              <Pastille ton={tonMethode(p.methode)}>
                <Layers size={11} strokeWidth={2.4} />
                {p.methode.libelle}
                {p.methode.source === "déduite" && <span className="opacity-60">déduite</span>}
              </Pastille>
            </span>
          )}
          {p.domaine && <Pastille>{p.domaine}</Pastille>}
          {p.source === "manuelle" && <Pastille ton="accent">Cible manuelle</Pastille>}
          {p.echeance && <Pastille ton="pause">Échéance {dateCourte(p.echeance)}</Pastille>}
        </div>
        <h1 className="t-display flex items-center gap-5">
          <span
            className={`grid h-20 w-20 shrink-0 place-items-center rounded-3xl border ${TUILE_TON[ton] ?? TUILE_TON.termine}`}
            aria-hidden="true"
          >
            <Icone size={44} strokeWidth={1.6} />
          </span>
          {p.nom}
        </h1>
        {p.description ? (
          <p className="t-chapo mt-3 max-w-3xl">{p.description}</p>
        ) : (
          <p className="mt-2.5 max-w-3xl text-[14px] leading-relaxed text-texte-3">
            Pas de description. En ajouter une : <code className="rounded bg-fond-3 px-1 py-0.5 text-[12px]">resume:</code>{" "}
            dans le frontmatter de sa fiche d'état.
          </p>
        )}
        {(clotures.progression || p.avancement != null) && (
          <div className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-4">
            <BlocProgression progression={clotures.progression} eclat={clotures.eclat} />
            {/* Le déclaré à côté du constaté, jamais l'un à la place de l'autre. */}
            {p.avancement != null && (
              <div className="w-64">
                <div className="mb-1.5 text-[11px] text-texte-3">Avancement déclaré</div>
                <Jauge valeur={p.avancement} ton={ton} />
              </div>
            )}
          </div>
        )}
      </header>

      <Liens p={p} />

      <nav className="mb-7 flex gap-1 border-b border-bord" role="tablist">
        {onglets.map((o) => (
          <button
            key={o.cle}
            role="tab"
            aria-selected={actif === o.cle}
            onClick={() => allerOnglet(o.cle)}
            className={`-mb-px flex items-center gap-2 border-b-[3px] px-4 py-3 text-[14px] transition ${
              actif === o.cle
                ? "border-b-vert font-bold text-actif"
                : "border-b-transparent font-medium text-texte-3 hover:border-b-vert-bord hover:text-texte"
            }`}
          >
            <o.icone size={14} strokeWidth={2} />
            {o.libelle}
            {o.compte > 0 && (
              <span className="tabulaire rounded-full bg-vert-pale px-2 py-0.5 text-[11px] font-bold text-actif">
                {o.compte}
              </span>
            )}
            {o.attente > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-arbitrage"
                title={`${o.attente} outil(s) attendent un retour de ta part`}
              />
            )}
            {o.alerte > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-bloque"
                title={`${o.alerte} conclusion(s) à reporter à l'archive`}
              />
            )}
          </button>
        ))}
      </nav>

      {actif === "outils" && <ProjetOutils p={p} aller={aller} />}
      {actif === "agents" && <ProjetAgents p={p} />}
      {actif === "usage" && <ProjetUsage p={p} allerOnglet={allerOnglet} />}
      {actif === "essais" && <ProjetEssais p={p} />}
      {actif === "evaluation" && <ProjetEvaluation etat={etat} aller={aller} />}
      {actif === "suivi" && <Suivi p={p} clotures={clotures} />}
    </div>
  );
}

/** L'onglet de suivi : l'écran d'origine, inchangé. */
function Suivi({ p, clotures }) {
  return (
    <>
      {p.alertes?.length > 0 && (
        <div className="mb-7 flex flex-wrap gap-2">
          {p.alertes.map((a, i) => (
            <Pastille key={i} ton={TON_ALERTE[a.niveau]}>
              {a.texte}
            </Pastille>
          ))}
        </div>
      )}

      {!p.instrumente && <SansEtat p={p} />}

      <div className="grille-projet">
        <div className="min-w-0 space-y-7">
          {/* Toujours rendue, même vide : c'est la section qui alimente la vue
              générale, son absence doit se voir plutôt que disparaître. */}
          <Section titre="Où on en est" icone={Info}>
            <div className="rounded-xl border border-bord bg-fond-2 p-5">
              {p.ouOnEnEst ? (
                <p className="text-[14px] leading-relaxed text-texte-2">{p.ouOnEnEst}</p>
              ) : (
                <p className="text-[13px] leading-relaxed text-texte-3">
                  Section vide. C'est elle qui remplit la carte du projet en vue générale : deux ou trois lignes sous{" "}
                  <code className="rounded bg-fond-3 px-1 py-0.5 text-[12px]">## Où on en est</code> dans sa fiche
                  d'état suffisent.
                </p>
              )}
              {p.brief && (
                <details className="mt-4 border-t border-bord pt-3">
                  <summary className="cursor-pointer text-[12px] font-medium text-texte-3 hover:text-texte-2">
                    Voir le brief
                  </summary>
                  <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-texte-3">{p.brief}</p>
                </details>
              )}
            </div>
          </Section>

          {p.sousProjets?.length > 0 && <SousProjets items={p.sousProjets} />}

          {/* Pas de `vide` ici : la liste « Fait » reste accessible même quand
              toutes les étapes sont bouclées. */}
          <Section titre="Prochaines étapes" compte={clotures.ouvertes.length} icone={ListTodo}>
            {p.instrumente ? (
              <ChecklistEtapes {...clotures} />
            ) : (
              <Puces items={p.etapes} ton="actif" vide="Aucune étape en attente." />
            )}
          </Section>

          <Section
            titre="Dernières sessions"
            compte={p.sessions?.length ?? 0}
            icone={History}
            vide="Aucune session consignée. Cette liste se tient à la main dans etat.md."
          >
            <Puces items={parDate(p.sessions)} ton="accent" />
          </Section>
        </div>

        <div className="min-w-0 space-y-7">
          {p.outils?.graphe?.miniature && <MiniatureGraphe graphe={p.outils.graphe} />}

          {/* Rouge quand il y a une décision en suspens, vert quand il n'y a
              rien : la couleur dit l'état avant que le texte soit lu. */}
          <Section
            titre="Arbitrages en attente"
            compte={p.arbitrages?.length ?? 0}
            icone={Scale}
            tonCompte="bloque"
            vide="Rien à trancher."
          >
            <Puces items={p.arbitrages} ton="bloque" />
          </Section>

          <Section
            titre="Points de vigilance"
            compte={p.vigilance?.length ?? 0}
            icone={ShieldAlert}
            tonCompte="pause"
            vide="Rien à signaler."
          >
            <Puces items={p.vigilance} ton="pause" />
          </Section>

          <Section titre="Relevé disque" icone={HardDrive}>
            <dl className="space-y-2 rounded-xl border border-bord bg-fond-2 p-4 text-[12px]">
              <Info2 cle="Dernière activité" val={`${depuis(p.disque?.derniereModif)} (${dateCourte(p.disque?.derniereModif)})`} />
              {p.disque?.dernierFichier && <Info2 cle="Dernier fichier" val={p.disque.dernierFichier} mono />}
              <Info2 cle="Contenu" val={`${p.disque?.nbFichiers ?? 0} fichiers · ${octetsLisibles(p.disque?.octets)}`} />
              {p.majDeclaree && <Info2 cle="etat.md mis à jour" val={dateCourte(p.majDeclaree)} />}
              <Info2 cle="Chemin" val={p.chemin.replace(/^\/Users\/[^/]+/, "~")} mono />
            </dl>
          </Section>

          {p.git && (
            <Section titre="Git" icone={GitBranch}>
              <dl className="space-y-2 rounded-xl border border-bord bg-fond-2 p-4 text-[12px]">
                <Info2 cle="Branche" val={p.git.branche ?? "-"} mono />
                <Info2 cle="Dernier commit" val={`${depuis(p.git.dernierCommit)} : ${p.git.dernierMessage ?? "-"}`} />
                <Info2 cle="Non commité" val={`${p.git.fichiersModifies} fichier(s)`} />
              </dl>
            </Section>
          )}

          {p.git?.copies?.length > 0 && (
            <Section titre="Copies de travail" compte={p.git.copies.length} tonCompte="accent" icone={GitFork}>
              <p className="mb-3 text-[12px] text-texte-3">
                Travail en cours à côté du projet, pas encore fusionné : rien de tout cela ne compte encore dans l'état du projet.
              </p>
              <ul className="space-y-2">
                {p.git.copies.map((c) => (
                  <li key={c.chemin} className="rounded-xl border border-bord bg-fond-2 p-4 text-[12px]">
                    <div className="font-mono text-[11px] text-texte-2 break-words">{c.branche ?? c.nom}</div>
                    <div className="mt-1.5 text-texte-3">{resumeCopie(c)}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {p.git?.historique && (
            <>
              <Section titre="Branches" compte={p.git.historique.branches.length} icone={GitBranch}>
                <GrapheBranches h={p.git.historique} />
              </Section>
              <Section titre="Commits" icone={GitCommitHorizontal}>
                <RythmeCommits h={p.git.historique} />
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Vignette du graphe Graphify, en tête de la colonne de droite.
 *
 * Les positions sont calculées au scan (`graphe-miniature.mjs`) : ici on ne
 * fait que tracer. Un clic ouvre le vrai `graph.html`, interactif, dans le
 * navigateur par défaut : la vignette est une porte, pas un outil.
 */
function MiniatureGraphe({ graphe }) {
  const m = graphe.miniature;
  const marge = 4;
  // Angle d'or : des teintes bien écartées pour des communautés voisines,
  // sans palette à tenir à jour. Luminosité basse pour se lire sur fond clair.
  const teinte = (c) => (c < 0 ? "var(--color-texte-3)" : `oklch(0.56 0.13 ${(c * 137.508) % 360})`);
  const rayon = (d) => 0.7 + Math.sqrt(d) * 0.38;

  return (
    <Section titre="Graphe du code" icone={Network}>
      <button
        onClick={() => graphe.lienHtml && ouvrir(graphe.lienHtml)}
        disabled={!graphe.lienHtml}
        title={graphe.lienHtml ? "Ouvrir le graphe interactif (graph.html)" : "graph.html absent"}
        className="group block w-full overflow-hidden rounded-xl border border-bord bg-fond-2 text-left transition hover:border-bord-vif disabled:cursor-default"
      >
        <svg
          viewBox={`${-marge} ${-marge} ${m.largeur + 2 * marge} ${m.hauteur + 2 * marge}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-48 w-full"
          role="img"
          aria-label={`Graphe de ${graphe.noeuds} nœuds répartis en ${m.communautes} communautés`}
        >
          <g stroke="var(--color-bord-vif)" strokeWidth="0.25" strokeOpacity="0.6">
            {m.liens.map(([a, b], i) => (
              <line key={i} x1={m.noeuds[a][0]} y1={m.noeuds[a][1]} x2={m.noeuds[b][0]} y2={m.noeuds[b][1]} />
            ))}
          </g>
          <g>
            {m.noeuds.map(([x, y, c, d], i) => (
              <circle key={i} cx={x} cy={y} r={rayon(d)} fill={teinte(c)} />
            ))}
          </g>
        </svg>
        <div className="flex items-center gap-2 border-t border-bord px-4 py-2.5 text-[11px] text-texte-3">
          <span className="tabulaire">
            {graphe.noeuds} nœuds · {m.communautes} communautés
            {m.tronque && " · vignette réduite aux plus connectés"}
          </span>
          <span className="ml-auto">construit {depuis(graphe.construit)}</span>
          {graphe.lienHtml && (
            <ExternalLink size={12} strokeWidth={2} className="text-texte-3 transition group-hover:text-accent" />
          )}
        </div>
      </button>
    </Section>
  );
}

function Liens({ p }) {
  const liens = [
    { libelle: "Dossier du projet", uri: p.ouverture?.dossier, icone: FolderOpen, type: "fichier" },
    p.ouverture?.etat && { libelle: "Fiche etat.md", ...p.ouverture.etat, icone: FileText },
    p.ouverture?.fichierCle && {
      libelle: p.ouverture.fichierCle.nom,
      ...p.ouverture.fichierCle,
      icone: FileText,
    },
    ...(p.liensDeclares ?? []).map((l) => ({ ...l, icone: ExternalLink })),
  ].filter(Boolean);

  return (
    <div className="mb-7 flex flex-wrap gap-2">
      <BoutonCopier texte={p.chemin} libelle="Copier le chemin" titre={`Copier ${p.chemin}`} />
      {liens.map((l, i) => (
        <button
          key={i}
          onClick={() => ouvrir(l.uri)}
          title={l.type === "obsidian" ? `Ouvrir dans Obsidian (${l.vault})` : "Ouvrir sur le disque"}
          className="flex items-center gap-2 rounded-lg border border-vert-bord bg-vert-pale px-3 py-2 text-[12.5px] font-medium text-accent transition hover:-translate-y-px hover:border-vert hover:shadow-marque active:translate-y-0 active:scale-[0.97]"
        >
          <l.icone size={13} strokeWidth={2.2} className={l.type === "obsidian" ? "text-arbitrage" : "text-vert"} />
          {l.libelle}
        </button>
      ))}
    </div>
  );
}

/**
 * Sous-projets déclarés dans `config/targets.json` : ce qui bouge dans chaque
 * dossier de la racine, sans tuile à part. Un clic ouvre le dossier, ou sa
 * fiche d'état s'il en a une. Constaté seulement, sauf fiche présente.
 */
function SousProjets({ items }) {
  const tries = [...items].sort((a, b) => (b.derniereModif ?? "").localeCompare(a.derniereModif ?? ""));
  return (
    <Section titre="Sous-projets" compte={items.length} tonCompte="accent" icone={FolderTree}>
      <ul className="space-y-2">
        {tries.map((s) => (
          <li key={s.dossier} className="rounded-xl border border-bord bg-fond-2 p-4 text-[12px]">
            {/* La carte se lit, elle ne s'ouvre pas : seul le petit bouton à droite ouvre. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-[13.5px] font-semibold text-texte">{s.nom}</span>
              <span className="flex items-center gap-2.5">
                <span className={`text-[11.5px] ${s.joursDepuisModif != null && s.joursDepuisModif <= 7 ? "text-actif" : "text-texte-3"}`}>
                  {depuis(s.derniereModif)}
                </span>
                {(s.ouverture?.etat?.uri || s.ouverture?.dossier) && (
                  <button
                    type="button"
                    onClick={() => ouvrir(s.ouverture?.etat?.uri ?? s.ouverture?.dossier)}
                    aria-label={`${s.ouverture?.etat ? "Ouvrir la fiche d'état" : "Ouvrir le dossier"} de ${s.nom}`}
                    title={s.ouverture?.etat ? "Ouvrir la fiche d'état" : "Ouvrir le dossier"}
                    className="inline-flex items-center gap-1 rounded-md border border-bord px-2 py-1 text-[11px] font-medium text-texte-2 transition hover:border-vert-bord hover:text-accent"
                  >
                    {s.ouverture?.etat ? <FileText size={12} strokeWidth={2} /> : <FolderOpen size={12} strokeWidth={2} />}
                    Ouvrir
                  </button>
                )}
              </span>
            </div>
              {(s.resume || s.role) && <p className="mt-1 leading-relaxed text-texte-2">{s.resume ?? s.role}</p>}
              {s.avancement != null && (
                <div className="mt-2.5">
                  <Jauge valeur={s.avancement} />
                </div>
              )}
            <div className="mt-2 text-texte-3">{resumeSousProjet(s)}</div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Ce que le disque dit d'un sous-projet, en une ligne. */
function resumeSousProjet(s) {
  const morceaux = [`${s.nbFichiers} fichier${s.nbFichiers > 1 ? "s" : ""}`];
  if (s.nbSkills) morceaux.push(`${s.nbSkills} skill${s.nbSkills > 1 ? "s" : ""} liée${s.nbSkills > 1 ? "s" : ""}`);
  if (s.git?.dernierCommit) morceaux.push(`dernier commit ${depuis(s.git.dernierCommit)}`);
  if (s.git?.fichiersModifies) morceaux.push(`${s.git.fichiersModifies} non commité${s.git.fichiersModifies > 1 ? "s" : ""}`);
  if (s.majDeclaree) morceaux.push(`fiche d'état du ${dateCourte(s.majDeclaree)}`);
  return morceaux.join(" · ");
}

function SansEtat({ p }) {
  return (
    <div className="mb-7 flex gap-3 rounded-xl border border-pause/30 bg-pause/[0.07] p-4">
      <CalendarClock size={17} className="mt-0.5 shrink-0 text-pause" strokeWidth={2} />
      <div className="text-[13px] leading-relaxed text-texte-2">
        <strong className="font-semibold text-texte">Projet non instrumenté.</strong> Sans{" "}
        <code className="rounded bg-fond-3 px-1 py-0.5 text-[11px]">wiki/etat.md</code>, le dashboard ne connaît que ce
        que le disque raconte : {p.disque?.nbFichiers ?? 0} fichiers, dernière activité {depuis(p.disque?.derniereModif)}.
        Le format attendu est décrit dans <code className="rounded bg-fond-3 px-1 py-0.5 text-[11px]">wiki/contrat-etat.md</code>.
      </div>
    </div>
  );
}

/**
 * Sessions de la plus récente à la plus ancienne. Le tri ne touche que
 * l'affichage : l'ordre de l'etat.md reste celui de Lois. Dates ISO, donc un
 * tri de chaînes suffit ; une entrée sans date garde sa place en fin de liste.
 */
function parDate(items) {
  if (!items?.length) return items;
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Ce qui distingue une copie de travail du projet, en une ligne. */
function resumeCopie(c) {
  const morceaux = [];
  if (c.aFusionner) morceaux.push(`${c.aFusionner} commit${c.aFusionner > 1 ? "s" : ""} à fusionner`);
  if (c.fichiersModifies) morceaux.push(`${c.fichiersModifies} fichier${c.fichiersModifies > 1 ? "s" : ""} non commité${c.fichiersModifies > 1 ? "s" : ""}`);
  if (c.etatModifie) morceaux.push("etat.md modifié");
  if (!morceaux.length) morceaux.push("aucun changement par rapport au projet");
  return `${morceaux.join(" · ")} · dernier commit ${depuis(c.dernierCommit)}`;
}

function Info2({ cle, val, mono }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-texte-3">{cle}</dt>
      <dd className={`min-w-0 break-words text-texte-2 ${mono ? "font-mono text-[11px]" : ""}`}>{val}</dd>
    </div>
  );
}
