/**
 * Miniature d'un graphe Graphify, calculée au scan.
 *
 * `graph.json` ne porte aucune position : c'est `graph.html` qui dispose les
 * nœuds en direct, dans le navigateur. Pour une vignette, on refait donc une
 * mise en page ici : une simulation de forces à la Fruchterman-Reingold,
 * sans modèle, sans token, en quelques dizaines de millisecondes.
 *
 * Deux choix qui comptent :
 *  · le tirage initial est seedé sur l'id du nœud, donc un graphe inchangé
 *    donne la même image à chaque scan : une vignette qui bouge sans raison
 *    laisserait croire que le code a bougé ;
 *  · au-delà de MAX_NOEUDS, on garde les nœuds les plus connectés. La
 *    répulsion est quadratique, et à cette taille les petits nœuds ne sont
 *    plus que du bruit.
 */

const MAX_NOEUDS = 500;
const ITERATIONS = 260;
const PORTEE = 3;
const GRAVITE = 0.35;

export function construireMiniature(g) {
  const bruts = Array.isArray(g?.nodes) ? g.nodes : [];
  const liensBruts = Array.isArray(g?.links) ? g.links : Array.isArray(g?.edges) ? g.edges : [];
  if (!bruts.length) return null;

  const degre = new Map();
  for (const l of liensBruts) {
    degre.set(l.source, (degre.get(l.source) ?? 0) + 1);
    degre.set(l.target, (degre.get(l.target) ?? 0) + 1);
  }

  const gardes = [...bruts]
    .sort((a, b) => (degre.get(b.id) ?? 0) - (degre.get(a.id) ?? 0))
    .slice(0, MAX_NOEUDS);
  const index = new Map(gardes.map((n, i) => [n.id, i]));

  const liens = [];
  for (const l of liensBruts) {
    const a = index.get(l.source);
    const b = index.get(l.target);
    if (a != null && b != null && a !== b) liens.push([a, b]);
  }

  const pos = placer(gardes, liens);

  // Coordonnées ramenées dans une boîte 0 à 100, au dixième : c'est une
  // vignette, la précision au-delà ne ferait qu'alourdir state.json.
  const xs = pos.map((p) => p[0]);
  const ys = pos.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const echelle = 100 / Math.max(x1 - x0, y1 - y0, 1e-6);
  const arrondi = (v) => Math.round(v * 10) / 10;

  return {
    largeur: arrondi((x1 - x0) * echelle),
    hauteur: arrondi((y1 - y0) * echelle),
    // [x, y, communauté, degré] : un tableau plutôt qu'un objet, pour le poids.
    noeuds: gardes.map((n, i) => [
      arrondi((pos[i][0] - x0) * echelle),
      arrondi((pos[i][1] - y0) * echelle),
      Number.isInteger(n.community) ? n.community : -1,
      degre.get(n.id) ?? 0,
    ]),
    liens,
    communautes: new Set(gardes.map((n) => n.community).filter(Number.isInteger)).size,
    tronque: bruts.length > gardes.length,
  };
}

/** Simulation de forces : répulsion entre tous, attraction le long des liens. */
function placer(noeuds, liens) {
  const n = noeuds.length;
  const k = Math.sqrt(1 / n); // distance idéale dans un carré unité
  const pos = noeuds.map((nd) => {
    const h = hacher(String(nd.id));
    return [(h & 0xffff) / 0xffff, (h >>> 16) / 0xffff];
  });

  let temperature = 0.1;
  const refroidir = temperature / (ITERATIONS + 1);
  const dep = Array.from({ length: n }, () => [0, 0]);

  for (let it = 0; it < ITERATIONS; it++) {
    for (const d of dep) d[0] = d[1] = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d2 = Math.max(dx * dx + dy * dy, 1e-6);
        // Portée bornée : au-delà de quelques k, deux nœuds s'ignorent. Sans
        // ça, deux composantes sans lien se repoussent jusqu'aux bords et la
        // vignette ne montre plus que du vide autour de deux points serrés.
        if (d2 > PORTEE * PORTEE * k * k) continue;
        const f = (k * k) / d2;
        dep[i][0] += dx * f; dep[i][1] += dy * f;
        dep[j][0] -= dx * f; dep[j][1] -= dy * f;
      }
    }

    for (const [a, b] of liens) {
      const dx = pos[a][0] - pos[b][0];
      const dy = pos[a][1] - pos[b][1];
      const d = Math.max(Math.hypot(dx, dy), 1e-6);
      const f = d / k;
      dep[a][0] -= dx * f; dep[a][1] -= dy * f;
      dep[b][0] += dx * f; dep[b][1] += dy * f;
    }

    // Une légère gravité vers le centre : sans elle, les composantes isolées
    // (un script sans lien au reste) partent aux bords et écrasent la vignette.
    for (let i = 0; i < n; i++) {
      dep[i][0] += (0.5 - pos[i][0]) * GRAVITE;
      dep[i][1] += (0.5 - pos[i][1]) * GRAVITE;
      const l = Math.max(Math.hypot(dep[i][0], dep[i][1]), 1e-9);
      const pas = Math.min(l, temperature);
      pos[i][0] += (dep[i][0] / l) * pas;
      pos[i][1] += (dep[i][1] / l) * pas;
    }
    temperature -= refroidir;
  }
  return pos;
}

/** FNV-1a 32 bits : assez pour disperser des ids, stable d'un scan à l'autre. */
function hacher(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
