#!/usr/bin/env node
/**
 * Scanner : point d'entrée.
 *
 * Lit la config, parcourt les projets et le catalogue d'outils, écrit
 * `data/state.json`. Ne consomme aucun token : rien ici n'appelle un modèle.
 * Ne modifie aucun projet : tout ce qui est écrit va dans `data/` : l'état
 * courant, et un instantané dans l'historique quand quelque chose a bougé.
 *
 *   node src/scanner/index.mjs [--silencieux]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chargerVaults } from "./obsidian.mjs";
import { listerCibles, construireProjet, resoudreChemin } from "./projects.mjs";
import { construireOutils, libellesDomaines } from "./tools.mjs";
import { consignerScan } from "./historique.mjs";
import { lireHistoriqueSessions, usageDuProjet } from "./usage.mjs";
import { construireBilan } from "./bilan.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const RACINE = path.resolve(ICI, "../..");

const CONFIG = path.join(RACINE, "config/targets.json");
const SORTIE = path.join(RACINE, "data/state.json");
const HISTORIQUE = path.join(RACINE, "data/historique.json");
const CACHE_USAGE = path.join(RACINE, "data/usage-cache.json");
const SYNTHESES = path.join(RACINE, "config/syntheses.json");

/** Synthèses des projets ; fichier absent ou illisible = pas de synthèse, sans bloquer le scan. */
function lireSyntheses() {
  try {
    return JSON.parse(fs.readFileSync(SYNTHESES, "utf8"));
  } catch {
    return {};
  }
}

export function scanner() {
  const debut = Date.now();
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const vaults = chargerVaults();

  // Le catalogue est construit d'abord : chaque projet s'en sert pour enrichir
  // ses propres outils (TL;DR, fiche, état global) sans relire les fiches.
  const { outils, orphelins, nbInstalles } = construireOutils(config, vaults);

  // Le projet qui héberge les fiches est celui qui porte l'onglet d'évaluation.
  const dossierFiches = resoudreChemin(config.catalogueOutils?.dossierFiches ?? "");

  const syntheses = lireSyntheses();

  const projets = listerCibles(config)
    .map((cible) => {
      try {
        const projet = construireProjet(cible, vaults, config.seuils, outils);
        projet.estCatalogue = !!dossierFiches && dossierFiches.startsWith(cible.chemin + path.sep);
        projet.icone ??= config.icones?.[projet.id] ?? null;
        // Phrase rédigée par Claude à la demande, lue telle quelle : le scan n'appelle aucun modèle.
        const texte = syntheses.projets?.[projet.id];
        projet.synthese = texte ? { texte, redigeLe: syntheses.redigeLe ?? null } : null;
        return projet;
      } catch (e) {
        return { id: cible.nom, nom: cible.nom, chemin: cible.chemin, erreur: String(e.message), alertes: [] };
      }
    })
    .sort(trierProjets);

  // Usage réel, relevé dans l'historique des sessions Claude Code, puis croisé
  // avec le banc et les fiches : ce qui a servi, ce qui est noté, ce qui attend.
  const sessions = lireHistoriqueSessions(CACHE_USAGE, config.usage);
  for (const p of projets) {
    if (p.erreur) continue;
    p.usage = usageDuProjet(p.chemin, sessions, outils, config.usage, p.imbriques);
    p.bilan = construireBilan({
      usage: p.usage,
      banc: p.banc,
      catalogue: outils,
      alias: [...(p.alias ?? []), p.nom, path.basename(p.chemin)],
      agentsProjet: p.agents?.agents,
      stack: p.outils?.stack,
      seuils: config.seuils,
    });
    // Chaque agent et chaque commande du projet savent combien de fois ils ont servi.
    const servi = (famille, nom) => p.usage.outils.find((o) => o.famille === famille && o.nom === nom);
    for (const a of p.agents?.agents ?? []) a.usage = resumeUsage(servi("agent", a.nom));
    for (const c of p.agents?.commandes ?? []) c.usage = resumeUsage(servi("commande", c.nom.replace(/^\//, "")));
  }

  // Index inverse : pour chaque outil du catalogue, les projets où il est
  // réellement branché. Le catalogue dit ce qui est disponible, ceci dit où
  // c'est utilisé : l'information que la page Outils n'avait pas.
  indexerPresence(projets, outils);

  const etat = {
    genereLe: new Date().toISOString(),
    dureeMs: Date.now() - debut,
    projets,
    outils,
    outilsOrphelins: orphelins,
    domaines: libellesDomaines(config.domainesOutils),
    resume: resumer(projets, outils, orphelins, nbInstalles),
    config: {
      racines: (config.racinesAutoDecouvertes ?? []).map(resoudreChemin),
      seuils: config.seuils ?? {},
    },
  };

  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, JSON.stringify(etat, null, 2), "utf8");
  consignerScan(HISTORIQUE, projets, etat.genereLe);
  return etat;
}

function resumeUsage(o) {
  return o ? { appels: o.appels, du: o.du, au: o.au, contexte: o.contextes[0]?.texte ?? null } : null;
}

/**
 * Attache à chaque outil du catalogue la liste des projets qui l'embarquent,
 * avec l'état local (actif, dormant, en attente d'approbation) et, le cas
 * échéant, le fait qu'un banc d'essai l'ait testé.
 */
function indexerPresence(projets, outils) {
  const parCle = new Map();
  const noter = (cle, entree) => {
    if (!cle) return;
    if (!parCle.has(cle)) parCle.set(cle, []);
    parCle.get(cle).push(entree);
  };

  for (const p of projets) {
    for (const famille of ["mcp", "skills", "stack"]) {
      for (const o of p.outils?.[famille] ?? []) {
        noter(o.cle, {
          projetId: p.id,
          projet: p.nom,
          famille,
          etat: o.etat,
          source: o.source,
        });
      }
    }
    for (const e of p.banc?.essais ?? []) {
      if (!e.teste) continue;
      noter(e.cle, {
        projetId: p.id,
        projet: p.nom,
        famille: "essai",
        etat: "teste",
        date: e.date,
        note: e.note,
        issue: e.issue,
        reporte: e.reporte,
      });
    }
  }

  for (const o of outils) {
    const entrees = parCle.get(o.cle) ?? [];
    o.presence = entrees;
    o.nbProjets = new Set(entrees.map((e) => e.projetId)).size;
    o.actifQuelquePart = entrees.some((e) => e.etat === "actif");
  }
}

/**
 * Ordre d'affichage de la vue générale : ce qui réclame une décision d'abord,
 * puis ce qui a bougé récemment. Un projet terminé descend toujours en bas.
 */
function trierProjets(a, b) {
  const poids = (p) => {
    if (p.statut === "termine") return 3;
    if (p.statut === "en-pause") return 2;
    return (p.alertes ?? []).some((x) => x.niveau === "urgent") ? 0 : 1;
  };
  const d = poids(a) - poids(b);
  if (d !== 0) return d;
  return (b.disque?.derniereModif ?? "").localeCompare(a.disque?.derniereModif ?? "");
}

function resumer(projets, outils, orphelins, nbInstalles) {
  const actifs = projets.filter((p) => p.statut === "actif");
  // Un outil peut figurer dans deux catégories de l'index (certains y sont
  // deux fois). L'affichage le montre à sa place dans chacune, les compteurs non.
  const uniques = [...new Map(outils.map((o) => [o.cle, o])).values()];
  return {
    nbProjets: projets.length,
    nbActifs: actifs.length,
    nbInstrumentes: projets.filter((p) => p.instrumente).length,
    nbArbitrages: projets.reduce((n, p) => n + (p.arbitrages?.length ?? 0), 0),
    nbVigilance: projets.reduce((n, p) => n + (p.vigilance?.length ?? 0), 0),
    nbEtapesOuvertes: projets.reduce((n, p) => n + (p.etapes?.length ?? 0), 0),
    nbDormants: projets.filter((p) => (p.alertes ?? []).some((a) => a.code === "dormant")).length,
    nbUrgences: projets.filter((p) => (p.alertes ?? []).some((a) => a.niveau === "urgent")).length,
    nbOutilsProjet: projets.reduce((n, p) => n + (p.outils?.resume?.total ?? 0), 0),
    nbSansDescription: projets.filter((p) => !p.description).length,
    // Essais menés dans les projets, et ceux dont la conclusion n'a pas encore
    // rejoint l'archive de « Skills-Lib ».
    essais: {
      bancs: projets.filter((p) => p.banc).length,
      testes: projets.reduce((n, p) => n + (p.banc?.resume?.testes ?? 0), 0),
      nonTestes: projets.reduce((n, p) => n + (p.banc?.resume?.nonTestes ?? 0), 0),
      aReporter: projets.reduce((n, p) => n + (p.banc?.resume?.aReporter ?? 0), 0),
    },
    // Ce qui attend un retour de Lois, tous projets confondus.
    bilan: {
      attente: projets.reduce((n, p) => n + (p.bilan?.resume?.attente ?? 0), 0),
      aEvaluer: projets.reduce((n, p) => n + (p.bilan?.resume?.aEvaluer ?? 0), 0),
      noteManquante: projets.reduce((n, p) => n + (p.bilan?.resume?.noteManquante ?? 0), 0),
      ficheManquante: projets.reduce((n, p) => n + (p.bilan?.resume?.ficheManquante ?? 0), 0),
      aReporter: projets.reduce((n, p) => n + (p.bilan?.resume?.aReporter ?? 0), 0),
    },
    outils: {
      total: uniques.length,
      actifs: uniques.filter((o) => o.etat === "actif").length,
      aTester: uniques.filter((o) => o.etat === "a-tester" || o.etat === "installe-a-tester").length,
      declaresSeuls: uniques.filter((o) => o.etat === "declare-seul").length,
      horsCatalogue: orphelins.length,
      detectesMachine: nbInstalles,
      eprouves: uniques.filter((o) => o.eprouve).length,
    },
  };
}

// Exécution directe (pas à l'import : le serveur réutilise scanner()).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const etat = scanner();
  if (!process.argv.includes("--silencieux")) {
    const r = etat.resume;
    console.log(`Scan terminé en ${etat.dureeMs} ms → data/state.json`);
    console.log(`  ${r.nbProjets} projets (${r.nbActifs} actifs, ${r.nbInstrumentes} avec etat.md, ${r.nbDormants} dormants)`);
    console.log(`  ${r.nbEtapesOuvertes} étapes ouvertes · ${r.nbArbitrages} arbitrages · ${r.nbVigilance} points de vigilance`);
    console.log(`  outils : ${r.outils.actifs} actifs, ${r.outils.aTester} à tester, ${r.outils.declaresSeuls} déclarés non détectés, ${r.outils.horsCatalogue} hors catalogue`);
  }
}
