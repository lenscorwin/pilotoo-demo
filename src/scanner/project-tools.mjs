/**
 * Outils d'un projet donné : la couche que le catalogue global ignore.
 *
 * Le catalogue de `tools.mjs` est transverse : il décrit ce qui est posé sur
 * la machine, disponible partout. Ce module-ci répond à l'autre question :
 * « qu'est-ce qui est branché *sur ce projet*, et est-ce vraiment actif ? »
 *
 * La distinction qui compte : un serveur déclaré dans `.mcp.json` n'est pas
 * actif tant qu'il n'est pas approuvé dans `enabledMcpjsonServers`, et un
 * `mcp.json` sans point devant est un bloc posé mais volontairement dormant :
 * c'est la convention des starters.
 */
import fs from "node:fs";
import path from "node:path";
import { cleOutil } from "./tools.mjs";
import { uriOuverture } from "./obsidian.mjs";
import { separerFrontmatter } from "./markdown.mjs";
import { construireMiniature } from "./graphe-miniature.mjs";
import { habillerSkills } from "./skills-lisibles.mjs";

const lireJson = (chemin) => {
  try {
    return JSON.parse(fs.readFileSync(chemin, "utf8"));
  } catch {
    return null;
  }
};

/** Dépendances npm sans intérêt ici : elles ne disent rien d'un outillage choisi. */
const DEPS_BRUIT = new Set([
  "react", "react-dom", "typescript", "autoprefixer", "postcss",
  "@types/react", "@types/react-dom", "@types/node", "express", "concurrently",
]);

export function construireOutilsProjet(racine, catalogue, vaults) {
  const parCle = new Map(catalogue.map((o) => [o.cle, o]));
  const enrichir = (cle) => {
    const c = parCle.get(cle);
    if (!c) return null;
    return { tldr: c.tldr, fonction: c.fonction, lienFiche: c.lienFiche, etatGlobal: c.etat, categorie: c.categorie };
  };

  const mcp = detecterMcp(racine, enrichir);
  const skills = detecterSkills(racine, enrichir, vaults);
  const hooks = detecterHooks(racine);
  const graphe = detecterGraphify(racine);
  const stack = detecterStack(racine, enrichir);
  const permissions = detecterPermissions(racine);

  // Les skills regroupés par pack, avec nom lisible, rôle et liens : c'est ce
  // que l'onglet affiche. La liste à plat reste pour les compteurs et l'index.
  const ficheParNom = (nom) => parCle.get(cleOutil(nom))?.lienFiche ?? null;
  const packsSkills = habillerSkills(racine, skills, vaults, ficheParNom);
  for (const s of skills) delete s.texteComplet;

  const tout = [...mcp, ...skills, ...stack];
  return {
    mcp,
    skills,
    packsSkills,
    hooks,
    graphe,
    stack,
    permissions,
    resume: {
      total: tout.length + (graphe ? 1 : 0) + hooks.length,
      actifs: tout.filter((o) => o.etat === "actif").length + (graphe ? 1 : 0) + hooks.length,
      dormants: tout.filter((o) => o.etat === "dormant").length,
      enAttente: tout.filter((o) => o.etat === "non-approuve").length,
    },
  };
}

/**
 * Serveurs MCP du projet. Trois états, et c'est toute la subtilité :
 * `.mcp.json` + approuvé = actif, `.mcp.json` sans approbation = en attente,
 * `mcp.json` (sans point) = posé exprès mais inactif.
 */
function detecterMcp(racine, enrichir) {
  const approuves = new Set([
    ...(lireJson(path.join(racine, ".claude/settings.local.json"))?.enabledMcpjsonServers ?? []),
    ...(lireJson(path.join(racine, ".claude/settings.json"))?.enabledMcpjsonServers ?? []),
  ]);

  const sorties = [];
  for (const [fichier, dormantParDefaut] of [[".mcp.json", false], ["mcp.json", true]]) {
    const chemin = path.join(racine, fichier);
    const conf = lireJson(chemin);
    if (!conf?.mcpServers) continue;

    for (const [nom, def] of Object.entries(conf.mcpServers)) {
      const etat = dormantParDefaut ? "dormant" : approuves.has(nom) ? "actif" : "non-approuve";
      sorties.push({
        nom,
        cle: cleOutil(nom),
        famille: "mcp",
        source: fichier,
        etat,
        commande: [def.command, ...(def.args ?? [])].filter(Boolean).join(" "),
        // Les `_comment_x` du fichier sont des notes écrites à la main : elles
        // valent souvent mieux que la fiche du catalogue.
        note: tronquer(conf[`_comment_${nom.replace(/-/g, "_")}`] ?? null, 400),
        catalogue: enrichir(cleOutil(nom)),
      });
    }
  }
  return sorties;
}

/** Skills embarqués dans le projet : `skills/<nom>/SKILL.md` ou `.claude/skills/`. */
function detecterSkills(racine, enrichir, vaults) {
  const sorties = [];
  for (const base of ["skills", ".claude/skills"]) {
    const dossier = path.join(racine, base);
    let entrees = [];
    try {
      entrees = fs.readdirSync(dossier, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entrees) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const fiche = ["SKILL.md", "LISEZ-MOI-DABORD.md"]
        .map((n) => path.join(dossier, e.name, n))
        .find((p) => fs.existsSync(p));

      const meta = fiche ? lireEnteteSkill(fiche) : {};

      sorties.push({
        nom: meta.name ? String(meta.name) : e.name,
        cle: cleOutil(e.name),
        // Le nom du dossier est ce qu'on tape après `/` ; c'est aussi le seul
        // identifiant sûr (`hyperframes-cli` et `hyperframes` ont la même clé).
        dossier: e.name,
        famille: "skill",
        source: `${base}/`,
        // `disable-model-invocation: true` = méthode mode-dormant : le skill est
        // posé et invocable à la main, mais ne se déclenche jamais seul.
        etat: meta.dormant ? "dormant" : "actif",
        invocable: meta.invocable,
        version: meta.version,
        description: meta.description,
        descriptionComplete: meta.descriptionComplete,
        texteComplet: meta.texte,
        lien: fiche ? uriOuverture(fiche, vaults) : null,
        catalogue: enrichir(cleOutil(e.name)),
      });
    }
  }
  return sorties;
}

/** Frontmatter d'un SKILL.md : nom, version, et surtout le mode dormant. */
function lireEnteteSkill(chemin) {
  let texte;
  try {
    texte = fs.readFileSync(chemin, "utf8").slice(0, 8000);
  } catch {
    return {};
  }
  const { data, corps } = separerFrontmatter(texte);
  return {
    // Description entière (le dépliant l'affiche) et début du corps, où un skill
    // cite souvent les autres skills de son pack.
    descriptionComplete: data.description ? String(data.description) : null,
    texte: `${data.description ?? ""}\n${corps.slice(0, 6000)}`,
    name: data.name ?? null,
    version: data.version ? String(data.version) : null,
    dormant: data["disable-model-invocation"] === true,
    invocable: data["user-invocable"] === true,
    description: tronquer(data.description ? String(data.description) : null, 260),
  };
}

/** Hooks Claude Code déclarés pour ce projet. */
function detecterHooks(racine) {
  const sorties = [];
  for (const f of [".claude/settings.json", ".claude/settings.local.json"]) {
    const conf = lireJson(path.join(racine, f));
    for (const [evenement, blocs] of Object.entries(conf?.hooks ?? {})) {
      for (const bloc of blocs ?? []) {
        for (const h of bloc.hooks ?? []) {
          sorties.push({
            evenement,
            source: f,
            libelle: h.statusMessage ?? h.type ?? "commande",
            commande: tronquer(String(h.command ?? ""), 180),
          });
        }
      }
    }
  }
  return sorties;
}

/** Graphe Graphify : présent, de quand, et sa miniature. */
function detecterGraphify(racine) {
  const dossier = path.join(racine, "graphify-out");
  if (!fs.existsSync(dossier)) return null;

  const graphe = path.join(dossier, "graph.json");
  let construit = null;
  let noeuds = null;
  let miniature = null;
  if (fs.existsSync(graphe)) {
    try {
      construit = fs.statSync(graphe).mtime.toISOString();
      const g = JSON.parse(fs.readFileSync(graphe, "utf8"));
      noeuds = Array.isArray(g.nodes) ? g.nodes.length : null;
      miniature = construireMiniature(g);
    } catch { /* graphe illisible, on l'annonce comme non construit */ }
  }
  const html = path.join(dossier, "graph.html");
  return {
    present: true,
    construit,
    noeuds,
    miniature,
    // La vue interactive complète, ouverte dans le navigateur par défaut.
    lienHtml: fs.existsSync(html) ? `file://${encodeURI(html)}` : null,
    etat: construit ? "actif" : "installe-non-construit",
  };
}

/** Dépendances npm qui correspondent à un outil du catalogue. */
function detecterStack(racine, enrichir) {
  const pkg = lireJson(path.join(racine, "package.json"));
  if (!pkg) return [];

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const sorties = [];
  for (const [nom, version] of Object.entries(deps)) {
    if (DEPS_BRUIT.has(nom)) continue;
    const cle = cleOutil(nom);
    const fiche = enrichir(cle);
    // Sans fiche au catalogue, une dépendance n'est qu'une dépendance.
    if (!fiche) continue;
    sorties.push({
      nom,
      cle,
      famille: "stack",
      source: "package.json",
      etat: "actif",
      version: String(version),
      catalogue: fiche,
    });
  }
  return sorties;
}

/** Permissions Bash accordées localement, utile pour comprendre un comportement. */
function detecterPermissions(racine) {
  const conf = lireJson(path.join(racine, ".claude/settings.local.json"));
  return (conf?.permissions?.allow ?? []).slice(0, 20);
}

const tronquer = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
