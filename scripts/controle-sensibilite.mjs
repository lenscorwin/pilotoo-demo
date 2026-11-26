#!/usr/bin/env node
/**
 * Contrôle de sensibilité de la démo publique.
 *
 * Relit tout ce qui est public : chaque fichier suivi par git (code, config,
 * données, textes) et, quand elle existe, la démo compilée. Échoue si une
 * donnée sensible s'y trouve :
 *   - motifs génériques : chemin de dossier personnel, adresse e-mail autre
 *     que noreply, forme de clé d'accès, tiret long ;
 *   - mots privés, connus seulement par leur empreinte sha256
 *     (scripts/empreintes-sensibles.json) : le contrôle calcule l'empreinte
 *     de chaque mot et de chaque suite de mots lus, et compare. Il ne connaît
 *     jamais les mots eux-mêmes.
 *
 *   node scripts/controle-sensibilite.mjs              tout le dépôt
 *   node scripts/controle-sensibilite.mjs <chemin…>    autres dossiers ou fichiers
 *
 * Le journal ne recopie jamais un mot trouvé en entier : la vérification
 * tourne sur un dépôt public, son journal l'est aussi.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** La liste des empreintes elle-même : des valeurs hexadécimales, rien à y lire. */
const IGNORES = new Set(["scripts/empreintes-sensibles.json"]);
/** Lignes autorisées telles quelles, choix explicite : la signature d'auteur du README. */
const EXCEPTIONS = [{ fichier: "README.md", ligne: /^MIT\. Conçu par / }];
const TEXTES = new Set([".html", ".js", ".jsx", ".mjs", ".css", ".json", ".md", ".txt", ".svg", ".xml", ".map", ".webmanifest", ".yml", ".yaml", ".gitignore"]);
const SANS_EXTENSION = new Set(["LICENSE"]);
const estTexte = (f) => TEXTES.has(path.extname(f).toLowerCase()) || TEXTES.has(path.basename(f)) || SANS_EXTENSION.has(path.basename(f));

/** Par défaut : les fichiers suivis par git (et ceux qui vont l'être), plus la démo compilée. */
function parDefaut() {
  const suivis = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: RACINE, encoding: "utf8" })
    .split("\0")
    .filter((f) => f && !IGNORES.has(f) && estTexte(f) && fs.existsSync(path.join(RACINE, f)))
    .map((f) => path.join(RACINE, f));
  const demo = path.join(RACINE, "dist-demo");
  return fs.existsSync(demo) ? [...suivis, demo] : suivis;
}

const MOTIFS = [
  { nom: "chemin de dossier personnel", re: /\/(?:Users|home)\/[A-Za-z0-9._-]+/g },
  {
    nom: "adresse e-mail",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    sauf: (m) => /@users\.noreply\.github\.com$|^noreply@anthropic\.com$/i.test(m),
  },
  { nom: "clé d'accès", re: /\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { nom: "tiret long", re: /[\u2014\u2013]/g },
];

const empreintes = JSON.parse(fs.readFileSync(path.join(RACINE, "scripts/empreintes-sensibles.json"), "utf8"));
const MOTS = new Set(empreintes.mots);
const DEBUTS = new Set(empreintes.debuts);
const empreinte = (t) => crypto.createHash("sha256").update(empreintes.sel + "\n" + t).digest("hex");
const normaliser = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Masque un extrait : on garde la première et la dernière lettre. */
const masquer = (t) => (t.length <= 2 ? "*".repeat(t.length) : t[0] + "*".repeat(t.length - 2) + t.at(-1));

function* fichiers(dossier) {
  if (fs.statSync(dossier).isFile()) return yield dossier;
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const f = path.join(dossier, e.name);
    if (e.isDirectory()) yield* fichiers(f);
    else if (estTexte(e.name)) yield f;
  }
}

function controlerLigne(ligne) {
  const trouves = [];
  for (const { nom, re, sauf } of MOTIFS) {
    for (const m of ligne.matchAll(re)) if (!sauf?.(m[0])) trouves.push(`${nom} « ${masquer(m[0])} »`);
  }
  const mots = normaliser(ligne).split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < mots.length; i++) {
    for (let n = 1; n <= empreintes.motsMax && i + n <= mots.length; n++) {
      const suite = mots.slice(i, i + n).join(" ");
      if (MOTS.has(empreinte(suite))) trouves.push(`mot privé « ${masquer(suite)} »`);
    }
    for (let k = 3; k < mots[i].length; k++) {
      if (DEBUTS.has(empreinte(mots[i].slice(0, k)))) {
        trouves.push(`mot privé « ${masquer(mots[i])} »`);
        break;
      }
    }
  }
  return trouves;
}

const dossiers = process.argv.length > 2 ? process.argv.slice(2) : parDefaut();
const absents = dossiers.filter((d) => !fs.existsSync(d));
if (absents.length) {
  console.error(`Introuvable : ${absents.map((d) => path.relative(RACINE, d) || d).join(", ")}.`);
  process.exit(1);
}

let nbFichiers = 0;
const enCause = [];
for (const d of dossiers) {
  for (const f of fichiers(d)) {
    nbFichiers++;
    const lignes = fs.readFileSync(f, "utf8").split("\n");
    const rel = path.relative(RACINE, f);
    lignes.forEach((ligne, i) => {
      if (EXCEPTIONS.some((e) => e.fichier === rel && e.ligne.test(ligne))) return;
      for (const t of controlerLigne(ligne)) enCause.push(`${rel}:${i + 1}  ${t}`);
    });
  }
}

if (enCause.length) {
  console.error(`Contrôle de sensibilité : ${enCause.length} problème(s) dans ${new Set(enCause.map((x) => x.split(":")[0])).size} fichier(s).`);
  for (const x of enCause.slice(0, 50)) console.error("  " + x);
  if (enCause.length > 50) console.error(`  … et ${enCause.length - 50} autres.`);
  process.exit(1);
}
console.log(`Contrôle de sensibilité : ${nbFichiers} fichiers relus, rien de sensible.`);
