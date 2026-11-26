/**
 * Usage réel des outils, relevé dans l'historique des sessions Claude Code.
 *
 * `~/.claude/projects/<dossier>/*.jsonl` garde chaque session : les skills
 * appelés (avec les arguments, qui disent à quoi ils ont servi), les commandes
 * slash tapées, les serveurs MCP sollicités, les agents lancés, les commandes
 * shell. C'est la seule trace de ce qui a *servi*, par opposition à ce qui est
 * *installé*. Zéro token : on lit du JSON, on ne résume rien.
 *
 * Claude Code purge ces fichiers au bout de 30 jours (`cleanupPeriodDays`).
 * Le cache `data/usage-cache.json` garde l'extrait de chaque session, y compris
 * après la purge : l'historique de Pilotoo s'allonge pendant que celui de
 * Claude Code s'efface. On n'y conserve que des agrégats et de courts extraits,
 * jamais une conversation entière.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cleOutil } from "./tools.mjs";

const RACINE_SESSIONS = path.join(os.homedir(), ".claude/projects");
// À incrémenter dès que l'extraction change : sinon le cache resservirait l'ancienne lecture.
const VERSION_CACHE = 3;

/** Commandes intégrées à Claude Code : ce ne sont pas des outils à évaluer. */
const COMMANDES_NATIVES = new Set([
  "clear", "compact", "config", "cost", "doctor", "exit", "feedback", "help", "hooks", "init", "login", "logout",
  "mcp", "memory", "model", "permissions", "resume", "status", "agents", "auto-mode-setup", "fast", "ide",
  "plugin", "plugins", "rewind", "statusline", "terminal-setup", "vim", "review", "usage", "context", "export",
  "add-dir", "bug", "upgrade", "release-notes", "theme", "privacy-settings", "output-style", "todos", "tasks",
]);

/** Types d'agents fournis par Claude Code, pas écrits par Lois. */
const AGENTS_NATIFS = new Set(["general-purpose", "explore", "plan", "claude-code-guide", "statusline-setup", "fork", "claude"]);

/**
 * Phrases qui portent un jugement. Volontairement large : on ne garde que les
 * messages qui citent aussi un outil utilisé sur le projet, ce qui écarte
 * l'essentiel du bruit.
 */
const JUGEMENT =
  /trop cher|\bnull?\b|g[ée]nial|\bsuper\b|\btop\b|parfait|j'aime|aime pas|d[ée][çc]u|\bbof\b|impressionn|marche (pas|bien|mal)|fonctionne (pas|bien|mal)|pas terrible|excellent|catastroph|moche|trop lent|trop lourd|inutile|tr[eè]s utile|pratique|gal[eè]re|oublie|abandonn|on garde|je garde|retien|[ée]carte|pas convaincu|convaincu|nickel|bravo/i;

/**
 * Lit toutes les sessions, en ne réanalysant que les fichiers qui ont bougé.
 * Retourne la liste des sessions extraites (une entrée par fichier .jsonl).
 */
export function lireHistoriqueSessions(cheminCache, conf = {}) {
  let cache = { version: VERSION_CACHE, fichiers: {} };
  try {
    const lu = JSON.parse(fs.readFileSync(cheminCache, "utf8"));
    if (lu.version === VERSION_CACHE) cache = lu;
  } catch { /* premier scan, ou cache d'une version précédente */ }

  const binaires = Object.keys(conf.binaires ?? {});
  const presents = new Set();

  for (const fichier of listerJsonl(RACINE_SESSIONS)) {
    presents.add(fichier);
    let st;
    try {
      st = fs.statSync(fichier);
    } catch {
      continue;
    }
    const connu = cache.fichiers[fichier];
    if (connu && connu.mtimeMs === st.mtimeMs && connu.size === st.size) continue;
    cache.fichiers[fichier] = { mtimeMs: st.mtimeMs, size: st.size, ...extraireSession(fichier, binaires) };
  }

  // Une session disparue du disque a été purgée par Claude Code : on garde son
  // extrait, c'est précisément ce que le cache sert à préserver.
  for (const [f, e] of Object.entries(cache.fichiers)) e.purgee = !presents.has(f);

  try {
    fs.mkdirSync(path.dirname(cheminCache), { recursive: true });
    fs.writeFileSync(cheminCache, JSON.stringify(cache), "utf8");
  } catch { /* cache non écrit : le scan suivant relira tout, sans gravité */ }

  return Object.values(cache.fichiers);
}

function listerJsonl(dossier) {
  const sorties = [];
  const parcourir = (d) => {
    let entrees = [];
    try {
      entrees = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith(".jsonl")) sorties.push(p);
    }
  };
  parcourir(dossier);
  return sorties;
}

/**
 * Extrait d'une session : appels agrégés par (dossier de travail, famille, nom)
 * et messages de Lois qui portent un jugement.
 */
function extraireSession(fichier, binaires) {
  const appels = new Map();
  const paroles = [];
  let dernierPrompt = null;
  let texte;
  try {
    texte = fs.readFileSync(fichier, "utf8");
  } catch {
    return { appels: [], paroles: [] };
  }

  const noter = (cwd, t, famille, nom, contexte) => {
    if (!cwd || !nom) return;
    const cle = `${cwd}\u0000${famille}\u0000${nom}`;
    const a = appels.get(cle) ?? { cwd: nfc(cwd), famille, nom, n: 0, du: t, au: t, contextes: [] };
    a.n += 1;
    if (t && (!a.du || t < a.du)) a.du = t;
    if (t && (!a.au || t > a.au)) a.au = t;
    const c = propre(contexte, 220);
    if (c && a.contextes.length < 4 && !a.contextes.some((x) => x.texte === c)) a.contextes.push({ date: t, texte: c });
    appels.set(cle, a);
  };

  for (const ligne of texte.split("\n")) {
    if (!ligne) continue;
    let o;
    try {
      o = JSON.parse(ligne);
    } catch {
      continue;
    }
    const contenu = o.message?.content;
    const t = o.timestamp ?? null;

    if (o.type === "user" && !o.isMeta) {
      const brut = typeof contenu === "string"
        ? contenu
        : Array.isArray(contenu) ? contenu.filter((b) => b.type === "text").map((b) => b.text).join("\n") : "";
      if (!brut) continue;

      // Commande slash tapée par Lois : seule voie d'appel d'un skill dormant.
      const cmd = /<command-name>\/?([^<\s]+)<\/command-name>/.exec(brut);
      if (cmd) {
        const nom = cmd[1].trim();
        if (!COMMANDES_NATIVES.has(nom.toLowerCase())) {
          const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(brut)?.[1];
          noter(o.cwd, t, "commande", nom, args);
          if (args?.trim()) dernierPrompt = args;
        }
        continue;
      }
      if (/^\s*<(local-command|bash-|task-notification)/.test(brut) || brut.startsWith("Caveat:")) continue;

      const message = nettoyerMessage(brut);
      if (!message) continue;
      dernierPrompt = message;
      if (JUGEMENT.test(message)) paroles.push({ cwd: nfc(o.cwd), date: t, texte: propre(message, 600) });
      continue;
    }

    if (o.type !== "assistant" || !Array.isArray(contenu)) continue;
    for (const b of contenu) {
      if (b.type !== "tool_use") continue;
      const nom = b.name ?? "";
      const entree = b.input ?? {};

      if (nom === "Skill") {
        noter(o.cwd, t, "skill", entree.skill, entree.args || dernierPrompt);
      } else if (nom === "Agent" || nom === "Task") {
        const type = String(entree.subagent_type ?? "general-purpose");
        if (!AGENTS_NATIFS.has(type.toLowerCase())) noter(o.cwd, t, "agent", type, entree.description || dernierPrompt);
      } else if (nom.startsWith("mcp__")) {
        noter(o.cwd, t, "mcp", serveurMcp(nom), dernierPrompt);
      } else if (nom === "Bash" && binaires.length) {
        for (const bin of binairesLances(String(entree.command ?? ""), binaires)) {
          // La demande de Lois dit à quoi ça a servi ; la description de la
          // commande ne dit que ce qu'elle fait.
          noter(o.cwd, t, "cli", bin, dernierPrompt || entree.description);
        }
      }
    }
  }

  return { appels: [...appels.values()], paroles };
}

/** `mcp__claude_ai_Higgsfield__balance` → `Higgsfield`, `mcp__plugin_accesslint_accesslint__x` → `accesslint`. */
function serveurMcp(nomOutil) {
  const srv = nomOutil.split("__")[1] ?? "";
  return srv.replace(/^claude_ai_/, "").replace(/^plugin_[^_]+_/, "").replace(/_/g, "-");
}

/** Binaires suivis lancés en tête d'un segment de commande, `npx` compris. */
function binairesLances(commande, binaires) {
  const trouves = new Set();
  for (const seg of commande.split(/&&|\|\||;|\||\n|\$\(/)) {
    const m = /^\s*(?:[A-Z_]+=\S*\s+)*(?:npx\s+(?:-y\s+|--yes\s+)?)?(?:\S*\/)?([\w.-]+?)(?:@[\w.^~-]+)?(?=\s|$)/.exec(seg);
    if (m && binaires.includes(m[1])) trouves.add(m[1]);
  }
  return trouves;
}

/** Retire les balises techniques injectées dans les messages. */
function nettoyerMessage(brut) {
  return brut
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<\/?pasted_content[^>]*>/g, "")
    .replace(/<[^>]{1,40}>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function propre(s, n) {
  if (!s) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

const nfc = (s) => (s ? String(s).normalize("NFC") : s);

/* ------------------------------------------------------------------ */
/* Assemblage par projet                                               */
/* ------------------------------------------------------------------ */

/**
 * Usage d'un projet : tout ce qui a été appelé depuis son dossier (ou un
 * sous-dossier), rattaché autant que possible à une fiche du catalogue.
 */
export function usageDuProjet(racine, sessions, outilsCatalogue, conf = {}, imbriques = []) {
  const base = nfc(path.resolve(racine));
  // Agentastic range ses worktrees à côté du projet, dans `<projet>-worktrees/<tâche>/` :
  // une session lancée là appartient au projet, pas à un dossier voisin.
  // Le dossier le plus précis l'emporte : une session dans graphoo/graphoo-v2
  // compte pour Graphoo V2, pas pour Graphoo qui le contient.
  const exclus = imbriques.map((x) => nfc(path.resolve(x)));
  const sousUnAutre = (cwd) => exclus.some((x) => cwd === x || cwd.startsWith(x + path.sep));
  const dedans = (cwd) =>
    !!cwd &&
    (cwd === base || cwd.startsWith(base + path.sep) || cwd.startsWith(base + "-worktrees" + path.sep)) &&
    !sousUnAutre(cwd);
  const rattacher = rattacheur(racine, outilsCatalogue, conf);
  const ignorer = new Set((conf.ignorer ?? []).map((x) => cleOutil(x)));

  const parNom = new Map();
  const idsSessions = new Set();
  let du = null;
  let au = null;
  let purgees = 0;

  for (const s of sessions) {
    let touche = false;
    for (const a of s.appels ?? []) {
      if (!dedans(a.cwd)) continue;
      touche = true;
      const cle = `${a.famille}:${a.nom}`;
      const e = parNom.get(cle) ?? { nom: a.nom, famille: a.famille, appels: 0, sessions: 0, du: a.du, au: a.au, contextes: [] };
      e.appels += a.n;
      e.sessions += 1;
      if (a.du && (!e.du || a.du < e.du)) e.du = a.du;
      if (a.au && (!e.au || a.au > e.au)) e.au = a.au;
      for (const c of a.contextes) if (!e.contextes.some((x) => x.texte === c.texte)) e.contextes.push(c);
      parNom.set(cle, e);
    }
    const parolesIci = (s.paroles ?? []).filter((p) => dedans(p.cwd));
    if (touche || parolesIci.length) {
      idsSessions.add(s);
      if (s.purgee) purgees += 1;
    }
    for (const a of (s.appels ?? []).filter((x) => dedans(x.cwd))) {
      if (a.du && (!du || a.du < du)) du = a.du;
      if (a.au && (!au || a.au > au)) au = a.au;
    }
  }

  // Une commande slash qui porte le nom d'un skill est un appel de ce skill ;
  // un « skill » qui est en fait une commande du projet redevient commande.
  // Les deux formes d'un même appel fusionnent ensuite.
  const fusion = new Map();
  for (const e of parNom.values()) {
    const maison = estCommandeProjet(racine, e.nom);
    const famille = maison ? "commande" : e.famille === "commande" ? "skill" : e.famille;
    const cle = `${famille}:${e.nom}`;
    const f = fusion.get(cle);
    if (!f) {
      fusion.set(cle, { ...e, famille, maison, contextes: [...e.contextes] });
      continue;
    }
    f.appels += e.appels;
    f.sessions += e.sessions;
    if (e.du && (!f.du || e.du < f.du)) f.du = e.du;
    if (e.au && (!f.au || e.au > f.au)) f.au = e.au;
    for (const c of e.contextes) if (!f.contextes.some((x) => x.texte === c.texte)) f.contextes.push(c);
  }
  const elements = [...fusion.values()].map((e) => ({
    ...e,
    contextes: premierEtDerniers(e.contextes),
  }));

  const outils = [];
  for (const e of elements) {
    if (ignorer.has(cleOutil(e.nom))) continue;
    // Agents et commandes du projet sont faits maison : pas de fiche à chercher.
    const fiche = e.famille === "agent" || e.maison ? null : rattacher(e.nom, e.famille);
    outils.push({ ...e, cle: cleOutil(e.nom), fiche: fiche ? { cle: fiche.cle, nom: fiche.nom } : null });
  }

  const paroles = sessions
    .flatMap((s) => (s.paroles ?? []).filter((p) => dedans(p.cwd)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    outils: outils.sort((a, b) => String(b.au).localeCompare(String(a.au))),
    paroles,
    sessions: idsSessions.size,
    sessionsPurgees: purgees,
    du,
    au,
  };
}

/**
 * Le premier appel dit pourquoi l'outil est entré dans le projet, les derniers
 * ce qu'il y fait encore. Les deux comptent, le milieu beaucoup moins.
 */
export function premierEtDerniers(contextes, n = 3) {
  const tries = [...contextes].sort((x, y) => String(x.date).localeCompare(String(y.date)));
  if (tries.length <= n + 1) return tries.reverse();
  return [...tries.slice(-n).reverse(), tries[0]];
}

function estCommandeProjet(racine, nom) {
  return fs.existsSync(path.join(racine, ".claude/commands", `${nom}.md`));
}

/**
 * Retrouve la fiche d'un outil appelé. Quatre voies, dans l'ordre :
 * nom exact, binaire déclaré dans la config, dépôt d'origine du skill
 * (`skills-lock.json` du projet ↔ `source :` de la fiche), puis préfixe
 * (`hyperframes-animation` → fiche `hyperframes`).
 */
function rattacheur(racine, catalogue, conf) {
  const parCle = new Map(catalogue.map((o) => [o.cle, o]));
  const parDepot = new Map(catalogue.filter((o) => o.depot).map((o) => [o.depot, o]));
  const cles = [...parCle.keys()].sort((a, b) => b.length - a.length);

  let lock = {};
  try {
    lock = JSON.parse(fs.readFileSync(path.join(racine, "skills-lock.json"), "utf8")).skills ?? {};
  } catch { /* projet sans lockfile */ }

  return (nom) => {
    const cle = cleOutil(nom);
    if (parCle.has(cle)) return parCle.get(cle);
    const cible = conf.binaires?.[nom];
    if (cible && parCle.has(cleOutil(cible))) return parCle.get(cleOutil(cible));
    const depot = lock[nom]?.source?.toLowerCase();
    if (depot && parDepot.has(depot)) return parDepot.get(depot);
    const prefixe = cles.find((c) => cle.startsWith(c + "-"));
    return prefixe ? parCle.get(prefixe) : null;
  };
}
