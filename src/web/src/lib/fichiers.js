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
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .catch(() => {
      // Échec passager : on réessaiera au prochain clic au lieu de rester vide.
      promesse = null;
      return {};
    })
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
    // Recherche simple plutôt qu'une regex : un nom de vault peut contenir ( ou [.
    const marque = `/${f.vault}/`;
    const i = f.chemin.lastIndexOf(marque);
    return i >= 0 ? f.chemin.slice(i + marque.length) : f.titre;
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
// Les liens [[wiki]] sont une extension de syntaxe : marked ne la cherche que
// dans le texte courant, jamais dans le code (`[[sujet]]` reste tel quel).
marked.use({
  gfm: true,
  renderer: {
    html: (token) => echapper(token.text ?? token.raw ?? ""),
  },
  extensions: [
    {
      name: "lienWiki",
      level: "inline",
      start: (src) => src.indexOf("[["),
      tokenizer(src) {
        const m = /^\[\[([^\]\n]+)\]\]/.exec(src);
        if (!m) return undefined;
        // Dans un tableau, Obsidian écrit [[cible\|alias]] : la barre est échappée.
        const [lien, alias] = m[1].split(/\\?\|/);
        return { type: "lienWiki", raw: m[0], lien: lien.trim(), texte: (alias ?? lien).trim() };
      },
      renderer: (t) => `<a href="wiki:${encodeURIComponent(t.lien)}">${echapper(t.texte)}</a>`,
    },
  ],
});

/** Markdown vers HTML, liens [[wiki]] compris. */
export function rendreMarkdown(corps) {
  return marked.parse(corps);
}
