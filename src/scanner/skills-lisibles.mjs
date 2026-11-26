/**
 * Skills lisibles : un nom en français, un rôle, une spécificité, des liens.
 *
 * Le nom de dossier d'un skill (`hyperframes-keyframes`) dit comment l'appeler,
 * pas ce qu'il fait ; sa description est en anglais et vise le modèle, pas Lois.
 * Ce module habille chaque skill d'un projet à partir de `config/skills.json`
 * (écrit à la main) et de deux sources lues sur le disque :
 *
 * - le pack d'origine, tiré de `skills-lock.json` du projet ;
 * - les liens que les skills déclarent eux-mêmes : une description qui cite un
 *   autre skill installé (« Unclear → /hyperframes », « use motion-graphics
 *   instead ») est un lien, relevé sans rien interpréter.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DICO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../config/skills.json");

let cache = null;
function dictionnaire() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DICO, "utf8"));
  } catch {
    cache = { packs: {}, skills: {} };
  }
  return cache;
}

/** Nom lisible d'un skill par son dossier, pour les autres vues (usage, bilan). */
export function nomLisible(dossier) {
  return dictionnaire().skills?.[dossier]?.nom ?? null;
}

/** Ordre d'affichage des types de lien, du plus utile au plus anecdotique. */
const TYPES = ["oriente", "alternative", "complement", "suite", "remplace", "cite"];

/**
 * Enrichit les skills détectés dans un projet. `skills` vient de
 * `project-tools.mjs` et porte déjà `dossier`, `description` et `chemin`.
 */
export function habillerSkills(racine, skills, vaults, uriFiche) {
  const dico = dictionnaire();
  const lock = lireLock(racine);
  const presents = new Set(skills.map((s) => s.dossier));

  const habilles = skills.map((s) => {
    const entree = dico.skills?.[s.dossier] ?? null;
    const idPack = entree?.pack ?? lock[s.dossier]?.source?.toLowerCase() ?? "autres";
    const pack = dico.packs?.[idPack] ?? { nom: idPack, role: null };

    const liens = [];
    const ajouter = (type, vers, source) => {
      if (vers === s.dossier || liens.some((l) => l.vers === vers)) return;
      liens.push({ type, vers, source, installe: presents.has(vers), nom: dico.skills?.[vers]?.nom ?? null });
    };
    for (const type of TYPES) for (const vers of entree?.liens?.[type] ?? []) ajouter(type, vers, "dictionnaire");
    for (const vers of citations(s.texteComplet ?? s.description ?? "", presents)) ajouter("cite", vers, "description");

    return {
      ...s,
      lisible: entree
        ? { nom: entree.nom, role: entree.role, specificite: entree.specificite ?? null }
        : { nom: humaniser(s.dossier), role: premierePhrase(s.description), specificite: null, aEcrire: true },
      pack: { id: idPack, nom: pack.nom, role: pack.role ?? null, fiche: pack.fiche ? uriFiche(pack.fiche) : null },
      liens: liens.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type)),
      texteComplet: undefined,
    };
  });

  // Regroupement par pack, les packs les plus fournis d'abord, « sans pack » en dernier.
  const groupes = new Map();
  for (const s of habilles) {
    if (!groupes.has(s.pack.id)) groupes.set(s.pack.id, { ...s.pack, skills: [] });
    groupes.get(s.pack.id).skills.push(s);
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, skills: g.skills.sort((a, b) => a.lisible.nom.localeCompare(b.lisible.nom, "fr")) }))
    .sort((a, b) => (a.id === "autres") - (b.id === "autres") || b.skills.length - a.skills.length);
}

function lireLock(racine) {
  try {
    return JSON.parse(fs.readFileSync(path.join(racine, "skills-lock.json"), "utf8")).skills ?? {};
  } catch {
    return {};
  }
}

/**
 * Autres skills installés cités dans un texte. Un nom à tiret (`motion-graphics`)
 * suffit ; un nom d'un seul mot (`figma`, `slideshow`) n'est retenu que précédé
 * d'une barre oblique ou entre accents graves, sinon « Figma » dans une phrase
 * deviendrait un lien.
 */
function citations(texte, presents) {
  const trouves = new Set();
  for (const nom of presents) {
    const echappe = nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const motif = nom.includes("-")
      ? new RegExp(`(^|[^\\w-])/?${echappe}(?![\\w-])`, "i")
      : new RegExp(`(/${echappe}|\`${echappe}\`)(?![\\w-])`, "i");
    if (motif.test(texte)) trouves.add(nom);
  }
  return trouves;
}

function humaniser(dossier) {
  const t = String(dossier).replace(/[-_]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function premierePhrase(description) {
  if (!description) return null;
  const p = /^(.{20,160}?[.!?])(\s|$)/.exec(description)?.[1] ?? description.slice(0, 160);
  return p.trim();
}
