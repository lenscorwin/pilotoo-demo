/**
 * Catalogue des fichiers de la démo : ce que les fenêtres simulées affichent
 * quand on clique « ouvrir ». Chargé une seule fois, au premier clic.
 *
 * Clés : les URI telles qu'elles figurent dans l'instantané, comparées sous
 * forme décodée (un dossier « Bot conversationnel » peut arriver en %20).
 */
import { marked } from "marked";

let promesse = null;
let index = null;
/** Même catalogue, par chemin affiché : retrouve une fiche Obsidian depuis le Finder. */
let parChemin = null;

export function chargerCatalogue() {
  promesse ??= fetch(`${import.meta.env.BASE_URL}demo/fichiers.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((brut) => {
      index = new Map(Object.entries(brut).map(([uri, f]) => [decoder(uri), { uri, ...f }]));
      parChemin = new Map([...index.values()].map((f) => [f.chemin, f]));
      return index;
    });
  return promesse;
}

const decoder = (u) => {
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
};

/** L'entrée d'une URI, ou null si elle n'est pas dans la démo. */
export function trouver(uri) {
  return index?.get(decoder(uri)) ?? null;
}

/** L'entrée d'un élément listé dans un dossier, si la démo la connaît. */
export function enfant(dossier, nom) {
  return trouver(`${decoder(dossier.uri)}/${nom}`) ?? parChemin?.get(`${dossier.chemin}/${nom}`) ?? null;
}

/** Fichiers markdown d'un même ensemble (vault ou dossier projet), pour la barre latérale. */
export function voisins(fichier) {
  if (!index) return [];
  const racine = racineDe(fichier);
  return [...index.values()].filter((f) => f.type === "md" && racineDe(f) === racine);
}

/** Nom de l'ensemble d'un fichier : son vault Obsidian, sinon son dossier projet. */
export function racineDe(f) {
  if (f.vault) return f.vault;
  const m = f.chemin.match(/^~\/Projets\/([^/]+)/);
  return m ? m[1] : "Projets";
}

/** Chemin relatif à la racine de l'ensemble, pour l'arborescence. */
export function cheminDansRacine(f) {
  if (f.vault) {
    const m = f.chemin.match(new RegExp(`${f.vault}/(.+)$`));
    return m ? m[1] : f.titre;
  }
  return f.chemin.replace(/^~\/Projets\/[^/]+\/?/, "") || f.titre;
}

/** Retrouve un fichier par le nom d'un lien [[wiki]], dans le même ensemble d'abord. */
export function resoudreLien(cible, depuis) {
  if (!index) return null;
  const nom = cible.split("|")[0].split("#")[0].trim().toLowerCase().replace(/\.md$/, "");
  const candidats = [...index.values()].filter(
    (f) => f.type === "md" && (f.titre.toLowerCase() === nom || cheminDansRacine(f).toLowerCase().replace(/\.md$/, "") === nom),
  );
  return candidats.find((f) => racineDe(f) === racineDe(depuis)) ?? candidats[0] ?? null;
}

/** Sépare le frontmatter YAML simple (clé: valeur) du corps. */
export function separerFrontmatter(texte) {
  const m = texte.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { proprietes: [], corps: texte };
  const proprietes = m[1]
    .split("\n")
    .map((l) => l.match(/^([\w-]+):\s*(.*)$/))
    .filter(Boolean)
    .map(([, cle, valeur]) => ({ cle, valeur: valeur.replace(/^["']|["']$/g, "") }));
  return { proprietes, corps: texte.slice(m[0].length) };
}

const echapper = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Le HTML brut éventuel des fichiers est affiché tel quel, jamais interprété.
marked.use({
  gfm: true,
  renderer: {
    html: (token) => echapper(token.text ?? token.raw ?? ""),
  },
});

/** Markdown vers HTML, avec les liens [[wiki]] transformés en liens internes. */
export function rendreMarkdown(corps) {
  const avecLiens = corps.replace(/\[\[([^\]]+)\]\]/g, (_, cible) => {
    const [lien, alias] = cible.split("|");
    return `[${(alias ?? lien).trim()}](wiki:${encodeURIComponent(lien.trim())})`;
  });
  return marked.parse(avecLiens);
}
