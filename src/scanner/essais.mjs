/**
 * Bancs d'essai : les évaluations d'outils menées *dans* un projet.
 *
 * Le principe posé le 2026-09-23 : un essai reste là où il a été mené, parce
 * que le contexte fait partie du résultat : le même outil peut gagner sur un
 * projet et perdre sur un autre. La base « Skills-Lib »
 * n'archive que la conclusion.
 *
 * Ce module lit le banc d'un projet et, croisé avec les fiches du catalogue,
 * répond à la seule question qui manquait : cette conclusion a-t-elle été
 * reportée, ou dort-elle encore dans le projet qui l'a produite ?
 */
import fs from "node:fs";
import path from "node:path";
import { separerFrontmatter, decouperSections, texteNu, normaliser } from "./markdown.mjs";
import { cleOutil } from "./tools.mjs";
import { uriOuverture } from "./obsidian.mjs";

/** Mots qui tranchent un verdict, cherchés dans la cellule « Verdict ». */
const VERDICTS = [
  { cle: "retenu", motifs: ["retenu", "retenue", "gardé", "gardee", "adopte", "adoptee"] },
  { cle: "ecarte", motifs: ["ecarte", "ecartee", "abandonne", "rejete", "perdu"] },
  { cle: "a-revoir", motifs: ["a revoir", "mitige", "incertain", "a retester"] },
];

/**
 * Lit le banc d'essai d'un projet.
 * Retourne null si le projet n'en déclare pas : la plupart n'en ont pas.
 */
export function lireBanc(racine, conf, vaults) {
  if (!conf?.banc) return null;
  const cheminBanc = path.join(racine, conf.banc);
  if (!fs.existsSync(cheminBanc)) return null;

  let texte;
  try {
    texte = fs.readFileSync(cheminBanc, "utf8");
  } catch {
    return null;
  }

  const { data, corps } = separerFrontmatter(texte);
  const sections = decouperSections(corps);
  const lignes = lireTableauSuivi(sections.suivi ?? "");

  const dossierVerdicts = conf.verdicts ? path.join(racine, conf.verdicts) : null;
  const verdictsExistants = listerVerdicts(dossierVerdicts);

  const essais = lignes.map((l) => {
    const fichierVerdict = trouverVerdict(l.lienVerdict ?? l.nom, verdictsExistants);
    return {
      ...l,
      teste: !!l.date,
      lien: fichierVerdict ? uriOuverture(fichierVerdict, vaults) : null,
    };
  });

  return {
    titre: String(data.title ?? "Banc d'essai"),
    fichier: conf.banc,
    lien: uriOuverture(cheminBanc, vaults),
    misAJour: data.updated ? String(data.updated) : null,
    essais,
    resume: {
      total: essais.length,
      testes: essais.filter((e) => e.teste).length,
      nonTestes: essais.filter((e) => !e.teste).length,
    },
  };
}

/**
 * Le tableau `Skill | Testée le | Sur quoi | Verdict | Note /5`.
 * Les colonnes sont retrouvées par leur intitulé, pas par leur position :
 * un tableau réordonné ne doit pas casser la lecture.
 */
function lireTableauSuivi(bloc) {
  const sorties = [];
  let colonnes = null;

  for (const ligne of bloc.split(/\r?\n/)) {
    if (!ligne.trim().startsWith("|")) {
      colonnes = null;
      continue;
    }
    const cellules = decouperLigne(ligne);
    if (cellules.every((c) => /^:?-{2,}:?$/.test(c))) continue;

    if (!colonnes) {
      colonnes = cellules.map((c) => normaliser(c));
      continue;
    }

    const champ = (...noms) => {
      for (const n of noms) {
        const i = colonnes.findIndex((c) => c.startsWith(n));
        if (i >= 0) return cellules[i] ?? "";
      }
      return "";
    };

    const nom = texteNu(cellules[0]).replace(/\s*\(.*\)$/, "").trim();
    if (!nom) continue;

    const brutVerdict = champ("verdict");
    const date = normaliserDate(champ("testee le", "teste le", "date"));

    sorties.push({
      nom,
      cle: cleOutil(nom),
      date,
      surQuoi: texteNu(champ("sur quoi", "contexte")) || null,
      verdict: texteNu(brutVerdict) || null,
      issue: classerVerdict(brutVerdict),
      note: normaliserNote(champ("note")),
      lienVerdict: premierWikilink(brutVerdict),
    });
  }
  return sorties;
}

/** Découpe une ligne de tableau en respectant les `\|` échappés. */
function decouperLigne(ligne) {
  return ligne
    .replace(/\\\|/g, "\u0000")
    .split("|")
    .slice(1, -1)
    .map((c) => c.replace(/\u0000/g, "|").trim());
}

const aUnVerdict = (e) => !!e.issue && e.issue !== "sans-verdict";

function classerVerdict(cellule) {
  const t = normaliser(cellule);
  if (!t) return null;
  for (const v of VERDICTS) if (v.motifs.some((m) => t.includes(m))) return v.cle;
  return "sans-verdict";
}

function normaliserDate(v) {
  const m = /(\d{4}-\d{2}(?:-\d{2})?)/.exec(String(v ?? ""));
  return m ? m[1] : null;
}

function normaliserNote(v) {
  const m = /(\d+(?:[.,]\d)?)/.exec(String(v ?? ""));
  return m ? Number(m[1].replace(",", ".")) : null;
}

function premierWikilink(cellule) {
  const m = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(String(cellule ?? ""));
  return m ? m[1].trim() : null;
}

function listerVerdicts(dossier) {
  if (!dossier) return [];
  try {
    return fs
      .readdirSync(dossier)
      .filter((n) => n.endsWith(".md") && !n.startsWith("_"))
      .map((n) => path.join(dossier, n));
  } catch {
    return [];
  }
}

/** Retrouve le fichier de verdict d'un outil, par son wikilink ou son nom. */
function trouverVerdict(reference, fichiers) {
  const cible = normaliser(path.basename(String(reference ?? ""), ".md"));
  if (!cible) return null;
  return fichiers.find((f) => normaliser(path.basename(f, ".md")) === cible) ?? null;
}

/**
 * Croise le banc d'un projet avec les retours des fiches du catalogue.
 *
 * Un essai est « reporté » quand la fiche de l'outil porte un retour dont le
 * champ projet correspond à ce projet-ci. C'est la marche décrite dans la
 * section « Après » du banc, et celle qui se saute le plus facilement.
 */
export function croiserAvecCatalogue(banc, catalogue, alias = []) {
  if (!banc) return null;

  const cles = new Set([...alias, ...alias.map(normaliser)].map(normaliser).filter(Boolean));
  const parCle = new Map(catalogue.map((o) => [o.cle, o]));

  const essais = banc.essais.map((e) => {
    const fiche = parCle.get(e.cle) ?? null;
    const retoursIci = (fiche?.retours ?? []).filter((r) => cles.has(normaliser(r.projet ?? "")));

    // Un retour qui dit « pas encore testé » n'est pas la conclusion d'un essai.
    const conclusions = retoursIci.filter((r) => !/pas encore test|non test/i.test(r.texte));

    return {
      ...e,
      aUneFiche: !!fiche,
      nomFiche: fiche?.nom ?? null,
      lienFiche: fiche?.lienFiche ?? null,
      retoursIci,
      reporte: conclusions.length > 0,
      // L'écart qui compte : testé et tranché ici, mais l'archive ne le sait pas.
      // Testé sans verdict, il n'y a rien à reporter : c'est une évaluation à donner.
      aReporter: e.teste && aUnVerdict(e) && conclusions.length === 0,
      verdictAttendu: e.teste && !aUnVerdict(e),
    };
  });

  return {
    ...banc,
    essais,
    resume: {
      ...banc.resume,
      reportes: essais.filter((e) => e.reporte).length,
      aReporter: essais.filter((e) => e.aReporter).length,
      sansFiche: essais.filter((e) => e.teste && !e.aUneFiche).length,
    },
  };
}
