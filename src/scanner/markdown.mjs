/**
 * Parseur markdown minimal : frontmatter YAML plat + découpage par titres `##`.
 *
 * Volontairement sans dépendance. Le frontmatter des fiches et des pages wiki
 * est du YAML plat et régulier (`cle: valeur`, plus quelques listes `[a, b]`) :
 * une vraie lib YAML apporterait surtout de la surface de maintenance.
 */

/** Sépare le frontmatter du corps. Pas de frontmatter → `data` vide. */
export function separerFrontmatter(texte) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(texte);
  if (!m) return { data: {}, corps: texte };
  return { data: parserYamlPlat(m[1]), corps: m[2] };
}

/**
 * YAML plat : `cle: valeur`, `cle: [a, b]`, listes `- item` sur la clé
 * précédente, et blocs repliés `cle: >` / `cle: |`, ces derniers sont
 * courants dans les `SKILL.md`, où la description tient sur plusieurs lignes.
 */
function parserYamlPlat(bloc) {
  const data = {};
  let clefListe = null;
  const lignes = bloc.split(/\r?\n/);

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;

    // Bloc replié : tout ce qui suit et qui est plus indenté appartient à la clé.
    const blocReplie = /^([A-Za-zÀ-ÿ0-9_.-]+)\s*:\s*([>|])[-+]?\s*$/.exec(ligne);
    if (blocReplie) {
      const indentation = (/^\s*/.exec(ligne) ?? [""])[0].length;
      const morceaux = [];
      while (i + 1 < lignes.length) {
        const suivante = lignes[i + 1];
        if (suivante.trim() && (/^\s*/.exec(suivante) ?? [""])[0].length <= indentation) break;
        morceaux.push(suivante.trim());
        i += 1;
      }
      data[blocReplie[1]] = morceaux.join(blocReplie[2] === ">" ? " " : "\n").trim();
      clefListe = null;
      continue;
    }

    const item = /^\s*-\s+(.*)$/.exec(ligne);
    if (item && clefListe) {
      data[clefListe].push(nettoyerScalaire(item[1]));
      continue;
    }

    const paire = /^([A-Za-zÀ-ÿ0-9_.-]+)\s*:\s*(.*)$/.exec(ligne);
    if (!paire) continue;

    const [, cle, brut] = paire;
    const valeur = brut.trim();

    if (valeur === "") {
      data[cle] = [];
      clefListe = cle;
      continue;
    }
    clefListe = null;

    if (valeur.startsWith("[") && valeur.endsWith("]")) {
      data[cle] = valeur
        .slice(1, -1)
        .split(",")
        .map((v) => nettoyerScalaire(v))
        .filter(Boolean);
    } else {
      data[cle] = nettoyerScalaire(valeur);
    }
  }
  return data;
}

function nettoyerScalaire(v) {
  const t = v.trim().replace(/^["']|["']$/g, "").trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
}

/**
 * Découpe un corps markdown en sections `##`.
 * Clé = titre normalisé (minuscules, sans accent, sans ponctuation).
 */
export function decouperSections(corps) {
  const sections = {};
  const lignes = corps.split(/\r?\n/);
  let titre = null;
  let tampon = [];

  const vider = () => {
    if (titre) sections[titre] = tampon.join("\n").trim();
    tampon = [];
  };

  for (const ligne of lignes) {
    const h = /^##\s+(.+?)\s*$/.exec(ligne);
    if (h) {
      vider();
      titre = normaliser(h[1]);
    } else if (titre) {
      tampon.push(ligne);
    }
  }
  vider();
  return sections;
}

/** « Où on en est ? » → « ou on en est ». Rend la reconnaissance tolérante. */
export function normaliser(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Extrait les puces d'une section, en reconnaissant les cases à cocher
 * et le séparateur de date `2026-09-20 · texte`.
 */
const VIDE = /^\(?\s*(rien|aucun|aucune|n[ée]ant|r\.?a\.?s)\b/i;

export function extrairePuces(bloc) {
  if (!bloc) return [];
  const puces = [];
  for (const ligne of bloc.split(/\r?\n/)) {
    // Puces `-`/`*` et listes numérotées `1.` / `1)` : les deux existent
    // dans les etat.md écrits avant le contrat.
    const m = /^\s*(?:[-*]|\d{1,2}[.)])\s+(.*)$/.exec(ligne);
    if (!m) continue;

    let texte = m[1].trim();
    let fait = null;

    const case_ = /^\[([ xX])\]\s*(.*)$/.exec(texte);
    if (case_) {
      fait = case_[1].toLowerCase() === "x";
      texte = case_[2].trim();
    }

    const date = /^(\d{4}-\d{2}-\d{2})\s*[·:\u2014-]\s*(.*)$/.exec(texte);
    const entree = { texte: texteNu(texte), fait };
    if (date) {
      entree.date = date[1];
      entree.texte = texteNu(date[2]);
    }
    // « (rien en attente) » est une façon d'écrire une liste vide, pas une entrée.
    if (entree.texte && !VIDE.test(entree.texte)) puces.push(entree);
  }
  return puces;
}

/**
 * Retire le balisage markdown d'une ligne destinée à l'affichage.
 * Le dashboard rend du texte brut : un `[[wikilink]]` ou un `**gras**` affiché
 * tel quel donne l'impression que la page est cassée.
 */
export function texteNu(ligne) {
  return String(ligne ?? "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\[[ xX]\]\s*/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Première ligne de texte utile d'un bloc : sert de résumé de repli. */
export function premiereLigne(bloc, maxi = 220) {
  if (!bloc) return "";
  const ligne = bloc
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith(">") && !l.startsWith("|") && !l.startsWith("#"));
  if (!ligne) return "";
  const nu = texteNu(ligne);
  return nu.length > maxi ? nu.slice(0, maxi - 1).trimEnd() + "…" : nu;
}
