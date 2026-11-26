#!/usr/bin/env node
/**
 * Serveur local du dashboard.
 *
 * Servir le front compilé, servir `data/state.json`, relancer le scan à la
 * demande, et dire ce qui a bougé depuis une date. Aucune route n'écrit hors
 * de `data/` : c'est la règle cardinale du projet, appliquée ici par
 * l'absence pure et simple de route d'écriture.
 *
 * Le serveur n'écoute que sur la boucle locale : rien de tout ceci ne doit
 * être joignable depuis le réseau.
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lireHistorique, progresDepuis } from "../scanner/historique.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCANNER = path.join(RACINE, "src/scanner/index.mjs");

/**
 * Le scan tourne dans un processus séparé, jamais par import.
 *
 * Deux raisons : un scanner modifié est pris en compte sans redémarrer le
 * serveur (sinon `/api/rescan` rejoue éternellement la version chargée au
 * démarrage), et une erreur pendant le scan ne peut pas emporter le serveur
 * avec elle.
 */
function lancerScan() {
  return new Promise((resoudre, rejeter) => {
    execFile(process.execPath, [SCANNER, "--silencieux"], { cwd: RACINE, timeout: 120_000 }, (err, _out, errOut) => {
      if (err) return rejeter(new Error(errOut?.trim() || err.message));
      resoudre();
    });
  });
}

const PORT = Number(process.env.PORT ?? 3737);
const HOTE = "127.0.0.1";
const ETAT = path.join(RACINE, "data/state.json");
const DIST = path.join(RACINE, "dist");
const HISTORIQUE = path.join(RACINE, "data/historique.json");

const app = express();
app.use(express.json({ limit: "64kb" }));

/**
 * Rien de ce que sert ce serveur ne doit être mis en cache par le navigateur.
 *
 * Les assets compilés portent un hash dans leur nom, donc leur cache est sans
 * risque ; `index.html` et l'API, eux, changent à chaque scan et à chaque
 * build. Sans ça, un rafraîchissement affiche l'état de la veille.
 */
app.use((req, res, suite) => {
  if (req.path.startsWith("/api/") || req.path === "/" || req.path.endsWith(".html")) {
    res.set("Cache-Control", "no-store, must-revalidate");
  }
  suite();
});

/** L'état courant. Scan à la volée si le fichier n'existe pas encore. */
app.get("/api/state", async (req, res) => {
  try {
    if (!fs.existsSync(ETAT)) await lancerScan();
    res.type("application/json").send(fs.readFileSync(ETAT, "utf8"));
  } catch (e) {
    res.status(500).json({ erreur: String(e.message) });
  }
});

/** Relance du scan. Gratuit : aucun appel de modèle là-dedans. */
app.post("/api/rescan", async (req, res) => {
  try {
    await lancerScan();
    const etat = JSON.parse(fs.readFileSync(ETAT, "utf8"));
    res.json({ ok: true, genereLe: etat.genereLe, dureeMs: etat.dureeMs, resume: etat.resume });
  } catch (e) {
    res.status(500).json({ ok: false, erreur: String(e.message) });
  }
});

/**
 * Ouverture d'un lien dans l'application native (Obsidian, Finder).
 *
 * `open` reçoit l'URI en argument séparé, jamais concaténée dans un shell :
 * les chemins contiennent des espaces et des accents, et une URI venue du
 * front ne doit jamais pouvoir devenir une commande.
 */
app.post("/api/ouvrir", (req, res) => {
  const uri = String(req.body?.uri ?? "");
  if (!/^(obsidian|file|https?):/i.test(uri)) {
    return res.status(400).json({ ok: false, erreur: "Schéma d'URI refusé" });
  }
  execFile("open", [uri], { timeout: 5000 }, (err) => {
    if (err) return res.status(500).json({ ok: false, erreur: String(err.message) });
    res.json({ ok: true });
  });
});

/**
 * Ce qui a bougé depuis `?depuis=<date ISO>` : étapes bouclées, arbitrages
 * tranchés, sessions ajoutées, jalons franchis. Lecture seule de l'historique.
 */
app.get("/api/progres", (req, res) => {
  const depuis = String(req.query.depuis ?? "");
  if (Number.isNaN(new Date(depuis).getTime())) return res.status(400).json({ erreur: "Date invalide" });
  res.json(progresDepuis(lireHistorique(HISTORIQUE), depuis));
});

app.get("/api/sante", (_req, res) => res.json({ ok: true, port: PORT }));

// Front compilé, avec repli SPA sur index.html.
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

app.listen(PORT, HOTE, () => {
  const construit = fs.existsSync(DIST);
  console.log(`Pilotoo sur http://${HOTE}:${PORT}`);
  if (!construit) console.log("  (front non compilé : `npm run build`, ou `npm run dev` pour le mode développement)");
});
