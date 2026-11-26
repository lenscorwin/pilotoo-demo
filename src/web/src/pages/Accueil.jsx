/**
 * Accueil : la visite guidée.
 *
 * La page présente la méthode avant l'outil : le problème, les trois
 * principes, puis les écrans qui les appliquent. Chaque étape mène au vrai
 * écran ou ouvre la vraie fiche, pour que le visiteur vérifie lui-même.
 *
 * Aucun chiffre n'est écrit en dur : tout est calculé depuis l'état chargé,
 * comme sur les autres pages.
 */
import React from "react";
import {
  ArrowDown, ArrowUpRight, GitBranch, BookOpen, Network, Terminal, PenTool, Code2, Mail,
} from "lucide-react";
import { ouvrir } from "../lib/api.js";
import { CONTACT_URL } from "../components/Demo.jsx";

/* Fiches ouvertes depuis la visite : toutes figurent parmi les fichiers
   montrés en entier dans la démo. */
const FICHES = {
  contrat: "file://~/Projets/Pilotoo/wiki/contrat-etat.md",
  cloture: "file://~/Projets/Pilotoo/.claude/skills/cloture/SKILL.md",
  vault: "obsidian://open?vault=Skills-Lib&file=HOME",
  graphify: "obsidian://open?vault=Skills-Lib&file=SKILLS%2Fgraphify",
};

export default function Accueil({ etat, aller }) {
  const projets = etat?.projets ?? [];
  const chiffres = calculerChiffres(etat);
  const ecart = premierEcart(projets);
  const pilotoo = projets.find((p) => p.id === "pilotoo") ?? projets.find((p) => p.git);

  const commencer = () =>
    document.getElementById("visite")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 py-8 lg:px-8">
      {/* ─── Ouverture : l'intention et les chiffres ─── */}
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="bento nuit monter flex flex-col !bg-fond p-8 lg:col-span-8" aria-labelledby="titre-accueil">
          <p className="t-surtitre text-texte-3">Visite guidée</p>
          <h1 id="titre-accueil" className="t-display mt-2 text-texte">
            Le tableau de bord de mes projets
          </h1>
          <p className="t-chapo mt-4 max-w-2xl text-texte-2">
            Je mène une dizaine de projets en parallèle avec Claude Code. MyDashboard Projets lit leurs dossiers et me dit où
            en est chacun, ce qui attend une décision et quels outils servent vraiment. Voici la méthode, en cinq
            étapes.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-8">
            <button
              onClick={commencer}
              className="inline-flex items-center gap-2 rounded-full bg-lavande px-5 py-2.5 text-[13px] font-bold text-encre transition hover:opacity-90 active:scale-[0.97]"
            >
              Commencer la visite
              <ArrowDown size={15} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button
              onClick={() => aller({ vue: "general" })}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-5 py-2.5 text-[13px] font-bold text-texte transition hover:bg-white/15 active:scale-[0.97]"
            >
              Aller à la vue générale
              <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="bento monter flex flex-col p-6 lg:col-span-4" aria-labelledby="titre-chiffres">
          <h2 id="titre-chiffres" className="t-h3 text-[15px]">Dans cette démo</h2>
          <dl className="mt-4 grid flex-1 grid-cols-2 content-center gap-x-4 gap-y-6">
            <Chiffre valeur={chiffres.projets} libelle="projets suivis" />
            <Chiffre valeur={`${chiffres.faites}/${chiffres.total}`} libelle="étapes cochées" />
            <Chiffre valeur={chiffres.sessions} libelle="sessions relevées" />
            <Chiffre valeur={chiffres.outils} libelle="outils au catalogue" />
          </dl>
          <p className="mt-5 text-[11.5px] leading-snug text-texte-3">
            Calculés à l'ouverture, depuis l'instantané du {chiffres.date}.
          </p>
        </section>
      </div>

      {/* ─── La visite ─── */}
      <section id="visite" className="scroll-mt-6" aria-labelledby="titre-visite">
        <h2 id="titre-visite" className="mb-4 px-1 font-title text-[22px] font-semibold text-texte">
          La visite, en cinq étapes
        </h2>
        <ol className="grid gap-4 lg:grid-cols-12">
          <Etape n={1} titre="Le problème" classe="lg:col-span-5">
            <p>
              Chaque projet a son dossier, son wiki, ses branches et ses sessions avec Claude. Après trois jours
              sur un autre sujet, je ne retrouvais plus le fil, ni quel projet attendait une décision de ma part.
            </p>
          </Etape>

          <Etape
            n={2}
            titre="Trois principes"
            classe="lg:col-span-7"
            action={{ libelle: "Lire le contrat de format", faire: () => ouvrir(FICHES.contrat) }}
          >
            <ul className="space-y-2.5">
              <Principe titre="Une seule source de vérité.">
                L'état d'un projet vit dans son fichier <code>etat.md</code>, écrit à la main ou dans Obsidian.
              </Principe>
              <Principe titre="Le déclaré face au constaté.">
                Le scanner relève les dates, l'état git et les outils installés. Quand ma fiche dit autre chose,
                MyDashboard Projets le signale au lieu de choisir.
              </Principe>
              <Principe titre="Rien ne s'écrit à ma place.">
                Le tableau de bord lit les projets, il n'écrit jamais dedans.
              </Principe>
            </ul>
          </Etape>

          <Etape
            n={3}
            titre="La vue générale et ses alertes"
            classe="lg:col-span-4"
            action={{ libelle: "Ouvrir la vue générale", faire: () => aller({ vue: "general" }) }}
          >
            <p>
              Un écran pour tous les projets : l'avancement, ce qui a bougé depuis ma dernière visite, et les
              écarts entre ce que j'ai écrit et ce que montre le disque.
              {ecart && (
                <>
                  {" "}
                  Ici, une fiche annonce {ecart.declare} % quand ses cases cochées disent {ecart.constate} %.
                </>
              )}
            </p>
          </Etape>

          <Etape
            n={4}
            titre="Une page projet"
            classe="lg:col-span-4"
            action={
              pilotoo && {
                libelle: `Ouvrir ${pilotoo.nom}`,
                faire: () => aller({ vue: "projet", id: pilotoo.id }),
              }
            }
          >
            <p>
              Le résumé, les étapes, les décisions en attente, les outils vraiment utilisés, et le graphe des
              branches git avec les copies de travail en cours.
            </p>
          </Etape>

          <Etape
            n={5}
            titre="La routine d'une session"
            classe="lg:col-span-4"
            action={{ libelle: "Lire la procédure de clôture", faire: () => ouvrir(FICHES.cloture) }}
          >
            <p>
              Au démarrage, Claude lit la fiche d'état avant tout. Chaque tâche part dans sa propre branche. En fin
              de session, « on clôture » met à jour la fiche, la page du sujet et le journal. Le scan suivant
              l'affiche ici.
            </p>
          </Etape>
        </ol>
      </section>

      {/* ─── Les outils ─── */}
      <section aria-labelledby="titre-outils">
        <h2 id="titre-outils" className="mb-4 px-1 font-title text-[22px] font-semibold text-texte">
          Les outils derrière la méthode
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Outil icone={GitBranch} nom="Agentastic">
            Une branche par tâche. Plusieurs agents avancent en parallèle, chacun dans sa copie de travail.
          </Outil>
          <Outil
            icone={BookOpen}
            nom="Obsidian"
            action={{ libelle: "Ouvrir la bibliothèque", faire: () => ouvrir(FICHES.vault) }}
          >
            Le wiki que j'écris : une page par sujet, une fiche d'état par projet, reliées entre elles.
          </Outil>
          <Outil
            icone={Network}
            nom="Graphify"
            action={{ libelle: "Lire la fiche", faire: () => ouvrir(FICHES.graphify) }}
          >
            La carte du code des gros projets, calculée en local. Claude l'interroge au lieu de relire tous les
            fichiers.
          </Outil>
          <Outil icone={Terminal} nom="Claude Code">
            Des hooks qui rappellent la clôture, des skills pour les rituels, des agents spécialisés par projet.
          </Outil>
          <Outil icone={PenTool} nom="Stack design">
            Figma, la skill apple-design, des audits d'accessibilité WCAG, et stop-slop pour relire les textes.
          </Outil>
          <Outil icone={Code2} nom="Stack code">
            React et Vite pour l'interface, Tailwind pour le style, Node pour le scanner. Playwright et Chrome
            DevTools pour vérifier dans le navigateur.
          </Outil>
        </ul>
      </section>

      {/* ─── Contact ─── */}
      <section
        className="bento nuit flex flex-wrap items-center justify-between gap-6 !bg-fond p-8"
        aria-labelledby="titre-contact"
      >
        <div className="max-w-xl">
          <h2 id="titre-contact" className="font-title text-[22px] font-semibold text-texte">
            Parlons-en
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-texte-2">
            Je suis designer UX/UI. Je conçois des interfaces, et des outils comme celui-ci pour mieux travailler.
          </p>
        </div>
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-lavande px-5 py-2.5 text-[13px] font-bold text-encre transition hover:opacity-90 active:scale-[0.97]"
        >
          <Mail size={15} strokeWidth={2.4} aria-hidden="true" />
          Me contacter sur graphoo.fr
        </a>
      </section>
    </div>
  );
}

/* ─── Calculs ─── */

function calculerChiffres(etat) {
  const projets = etat?.projets ?? [];
  const cumul = projets.reduce(
    (a, p) => ({ faites: a.faites + (p.progression?.faites ?? 0), total: a.total + (p.progression?.total ?? 0) }),
    { faites: 0, total: 0 }
  );
  const sessions = projets.reduce((n, p) => n + (p.usage?.sessions ?? 0), 0);
  const d = new Date(etat?.instantane ?? etat?.genereLe ?? Date.now());
  return {
    projets: projets.length,
    ...cumul,
    sessions,
    outils: etat?.resume?.outils?.total ?? etat?.outils?.length ?? 0,
    date: Number.isNaN(d.getTime()) ? "jour de l'instantané" : d.toLocaleDateString("fr-FR"),
  };
}

/**
 * Le premier écart entre avancement déclaré et étapes cochées, lu dans les
 * alertes du scanner (« Avancement déclaré 95 %, 2/17 étapes cochées (12 %) »).
 */
function premierEcart(projets) {
  for (const p of projets) {
    for (const a of p.alertes ?? []) {
      const m = String(a.titre ?? a.texte ?? "").match(/Avancement déclaré (\d+) %.*\((\d+) %/);
      if (m) return { declare: m[1], constate: m[2] };
    }
  }
  return null;
}

/* ─── Briques ─── */

function Chiffre({ valeur, libelle }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-[12px] leading-snug text-texte-3">{libelle}</dt>
      <dd className="tabulaire font-title text-[30px] font-semibold leading-none text-texte">{valeur}</dd>
    </div>
  );
}

function BoutonAction({ action }) {
  if (!action) return null;
  return (
    <button
      onClick={action.faire}
      className="group mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-texte/[0.06] px-3.5 py-1.5 text-[12.5px] font-bold text-texte transition hover:bg-texte/10 active:scale-[0.97]"
    >
      {action.libelle}
      <ArrowUpRight
        size={14}
        strokeWidth={2.4}
        aria-hidden="true"
        className="transition group-hover:-translate-y-px group-hover:translate-x-px"
      />
    </button>
  );
}

function Etape({ n, titre, classe = "", action, children }) {
  return (
    <li className={`bento flex flex-col gap-4 p-6 ${classe}`}>
      <div className="flex items-center gap-3">
        <span
          className="tabulaire grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lavande font-title text-[14px] font-semibold text-encre"
          aria-hidden="true"
        >
          {n}
        </span>
        <h3 className="t-h3 text-[16px]">
          <span className="sr-only">Étape {n} : </span>
          {titre}
        </h3>
      </div>
      <div className="visite-texte text-[13.5px] leading-relaxed text-texte-2">{children}</div>
      <BoutonAction action={action} />
    </li>
  );
}

function Principe({ titre, children }) {
  return (
    <li>
      <strong className="font-bold text-texte">{titre}</strong> {children}
    </li>
  );
}

function Outil({ icone: Icone, nom, action, children }) {
  return (
    <li className="bento flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lavande-pale text-lavande-encre" aria-hidden="true">
          <Icone size={17} strokeWidth={2} />
        </span>
        <h3 className="t-h3 text-[15px]">{nom}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-texte-2">{children}</p>
      <BoutonAction action={action} />
    </li>
  );
}
