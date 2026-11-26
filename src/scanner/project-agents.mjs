/**
 * Agents d'un projet : `.claude/agents/*.md`, et les commandes qui les mènent.
 *
 * `project-tools.mjs` répond à « qu'est-ce qui est branché ici » ; il ignorait
 * les agents, alors que c'est souvent ce qu'un projet a fabriqué de plus
 * spécifique : un skill s'installe, un agent s'écrit pour le chantier.
 *
 * Tout ce qui est affiché est tiré du fichier de l'agent lui-même :
 * - la spécialité, c'est la `description:` du frontmatter (ce que Claude lit
 *   pour décider de l'appeler) ;
 * - l'identité, c'est le premier paragraphe du corps, le « Tu es… » ;
 * - le périmètre d'accès se déduit de `tools:` : absent, l'agent a tout.
 */
import fs from "node:fs";
import path from "node:path";
import { separerFrontmatter, texteNu } from "./markdown.mjs";
import { uriOuverture } from "./obsidian.mjs";

/** Outils qui donnent à un agent le droit de modifier quelque chose. */
const ECRITURE = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

export function construireAgentsProjet(racine, vaults) {
  const agents = lireDossierMd(path.join(racine, ".claude/agents")).map((f) => lireAgent(f, vaults));
  const commandes = lireDossierMd(path.join(racine, ".claude/commands")).map((f) =>
    lireCommande(f, agents, vaults)
  );

  // Le lien dans l'autre sens : depuis la fiche d'un agent, savoir quelle
  // commande l'orchestre.
  for (const a of agents) {
    a.appelePar = commandes.filter((c) => c.agents.includes(a.nom)).map((c) => c.nom);
  }

  return {
    agents,
    commandes,
    resume: { agents: agents.length, commandes: commandes.length },
  };
}

function lireDossierMd(dossier) {
  try {
    return fs
      .readdirSync(dossier)
      .filter((n) => n.endsWith(".md") && !n.startsWith("."))
      .sort()
      .map((n) => path.join(dossier, n));
  } catch {
    return [];
  }
}

function lire(chemin) {
  try {
    return fs.readFileSync(chemin, "utf8");
  } catch {
    return "";
  }
}

function lireAgent(chemin, vaults) {
  const { data, corps } = separerFrontmatter(lire(chemin));
  const nom = data.name ? String(data.name) : path.basename(chemin, ".md");
  const outils = listeOutils(data.tools);
  const identite = premierParagraphe(corps);

  return {
    nom,
    specialite: data.description ? texteNu(String(data.description)) : null,
    identite: tronquer(identite, 420),
    role: roleDe(identite),
    // `null` = pas de `tools:` dans le frontmatter, donc tous les outils.
    outils,
    acces: accesDe(outils),
    modele: data.model ? String(data.model) : null,
    couleur: data.color ? String(data.color) : null,
    // Les titres `##` donnent la charpente du prompt en un coup d'œil.
    sections: titresH2(corps),
    // Serveurs MCP cités dans le prompt : ce que l'agent va solliciter.
    mcp: [...new Set([...corps.matchAll(/mcp__([a-z0-9-]+?)__/gi)].map((m) => m[1]))],
    majLe: dateModif(chemin),
    lien: uriOuverture(chemin, vaults),
    fichier: `.claude/agents/${path.basename(chemin)}`,
  };
}

function lireCommande(chemin, agents, vaults) {
  const { data, corps } = separerFrontmatter(lire(chemin));
  // Ordre d'apparition dans le texte : pour un pipeline, c'est l'ordre des étapes.
  const cites = agents
    .map((a) => ({ nom: a.nom, pos: corps.indexOf(a.nom) }))
    .filter((x) => x.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.nom);

  return {
    nom: `/${path.basename(chemin, ".md")}`,
    description: data.description ? texteNu(String(data.description)) : null,
    arguments: data["argument-hint"] ? String(data["argument-hint"]) : null,
    agents: cites,
    majLe: dateModif(chemin),
    lien: uriOuverture(chemin, vaults),
    fichier: `.claude/commands/${path.basename(chemin)}`,
  };
}

/** `tools: Read, Grep` ou `tools: [Read, Grep]` : les deux formes existent. */
function listeOutils(brut) {
  if (brut == null || (Array.isArray(brut) && brut.length === 0)) return null;
  const liste = Array.isArray(brut) ? brut : String(brut).split(",");
  const propres = liste.map((t) => String(t).trim()).filter(Boolean);
  return propres.length ? propres : null;
}

function accesDe(outils) {
  if (!outils) return "tout";
  if (outils.includes("Bash")) return "execute";
  if (outils.some((t) => ECRITURE.includes(t))) return "ecrit";
  return "lecture";
}

/** Premier paragraphe de prose du corps : là où l'agent se présente. */
function premierParagraphe(corps) {
  const blocs = corps.split(/\r?\n\s*\r?\n/);
  for (const b of blocs) {
    const t = b.trim();
    if (!t || t.startsWith("#") || t.startsWith("|") || t.startsWith("```")) continue;
    // `texteNu` lit `__` comme du gras : dans `mcp__serveur__outil`, il
    // mangerait les soulignés. On les protège le temps du nettoyage.
    const protege = t.replace(/\r?\n/g, " ").replace(/`[^`]+`/g, (c) => c.replace(/_/g, "\u0001"));
    return texteNu(protege).replace(/\u0001/g, "_");
  }
  return null;
}

/**
 * « Tu es le producteur vidéo du chantier… » → « Producteur vidéo ».
 * Seulement quand l'agent se nomme lui-même : un prompt qui commence par
 * « Tu assembles… » n'a pas de titre, on n'en invente pas.
 */
function roleDe(identite) {
  const m = /^Tu es (?:l'|le |la |les |un |une )?(.+?)(?= du | de | pour |[,.:;]|$)/.exec(identite ?? "");
  if (!m) return null;
  const r = m[1].trim();
  if (!r || r.length > 60) return null;
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function titresH2(corps) {
  return [...corps.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => texteNu(m[1])).slice(0, 8);
}

function dateModif(chemin) {
  try {
    return fs.statSync(chemin).mtime.toISOString();
  } catch {
    return null;
  }
}

const tronquer = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
