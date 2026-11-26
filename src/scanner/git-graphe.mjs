/**
 * Historique git d'un projet, mis en forme au scan pour deux schémas de la
 * vue projet : le graphe des branches et le rythme des commits.
 *
 * Comme pour la miniature Graphify, le front ne fait que tracer. Ici on lit
 * `git log`, on attribue chaque commit à une branche et on le pose sur une
 * voie : le même rangement que `git log --graph`, en données plutôt qu'en
 * caractères.
 *
 * Trois choix qui comptent :
 *  · une branche distante qui pointe au même endroit que la branche locale
 *    du même nom (`origin/main` et `main`) est fusionnée avec elle : deux
 *    voies pour un seul trait d'histoire, ce serait du bruit ;
 *  · la couleur suit la branche, jamais la voie. Une voie libérée est
 *    reprise par une autre branche plus bas ; si la couleur suivait la voie,
 *    deux branches sans rapport se ressembleraient ;
 *  · on lit tout l'historique mais on replie les suites de commits sans
 *    événement en une ligne « … n commits ». Sur les 40 derniers commits
 *    seulement, une histoire presque droite cachait la moitié des branches.
 *    Restent dépliés : les têtes de branche, les départs et les fusions, et
 *    les quelques commits les plus récents.
 */

const MAX_COMMITS = 400;
/** Commits les plus récents toujours dépliés, même sans événement. */
const RECENTS = 3;
const SEP = "\u0001";

/**
 * `git` est la fonction d'appel de `sonderGit` : elle renvoie la sortie, ou
 * une chaîne vide en cas d'échec.
 */
export function lireHistorique(git) {
  const brut = git("for-each-ref", "--sort=-committerdate", `--format=%(refname)${SEP}%(objectname:short)${SEP}%(committerdate:iso-strict)`, "refs/heads", "refs/remotes");
  if (!brut) return null;
  const courante = git("rev-parse", "--abbrev-ref", "HEAD");

  // Branches, distantes repliées sur leur jumelle locale quand elles coïncident.
  const refs = brut.split("\n").map((l) => {
    const [ref, tete, date] = l.split(SEP);
    const distante = ref.startsWith("refs/remotes/");
    return { nom: ref.replace(/^refs\/(heads|remotes)\//, ""), tete, date, distante };
  }).filter((r) => !(r.distante && r.nom.endsWith("/HEAD")));
  const locales = new Map(refs.filter((r) => !r.distante).map((r) => [r.nom, r]));
  const branches = [];
  for (const r of refs) {
    if (r.distante) {
      const jumelle = locales.get(r.nom.replace(/^[^/]+\//, ""));
      if (jumelle && jumelle.tete === r.tete) {
        jumelle.publiee = true;
        continue;
      }
      // Jumelle décalée : on compte ce que chacune a que l'autre n'a pas.
      // Côté local, ce sont les commits pas encore poussés.
      if (jumelle) {
        const [avance, retard] = git("rev-list", "--left-right", "--count", `${jumelle.nom}...${r.nom}`).split(/\s+/).map(Number);
        r.suit = { nom: jumelle.nom, avance: avance || 0, retard: retard || 0 };
      }
    }
    branches.push(r);
  }

  // Ordre de priorité, qui est aussi l'ordre des couleurs : la branche
  // courante, puis main/master, puis le reste du plus récent au plus ancien.
  const rang = (b) => (b.nom === courante ? 0 : /^(main|master)$/.test(b.nom) ? 1 : 2);
  branches.sort((a, b) => rang(a) - rang(b) || String(b.date).localeCompare(String(a.date)));

  const log = git("log", "--all", "--topo-order", `-n${MAX_COMMITS}`, `--format=%h${SEP}%p${SEP}%cI${SEP}%s`);
  const commits = log
    ? log.split("\n").map((l) => {
        const [h, parents, date, sujet] = l.split(SEP);
        return { h, parents: parents ? parents.split(" ") : [], date, sujet };
      })
    : [];

  // Chaque commit appartient à la première branche qui l'atteint en suivant
  // ses premiers parents, dans l'ordre de priorité ci-dessus.
  const parHash = new Map(commits.map((c) => [c.h, c]));
  const proprietaire = new Map();
  branches.forEach((b, i) => {
    let h = b.tete;
    while (h && parHash.has(h) && !proprietaire.has(h)) {
      proprietaire.set(h, i);
      h = parHash.get(h).parents[0];
    }
  });
  const etiquettes = new Map();
  branches.forEach((b, i) => {
    if (!etiquettes.has(b.tete)) etiquettes.set(b.tete, []);
    etiquettes.get(b.tete).push(i);
  });

  // Rangement en voies. `voies[j]` est le hash attendu sur la voie j à la
  // ligne suivante ; un commit se pose sur la première voie qui l'attend.
  let voies = [];
  const lignes = commits.map((c) => {
    let voie = voies.indexOf(c.h);
    if (voie < 0) {
      voie = voies.indexOf(null);
      if (voie < 0) voie = voies.length;
    }
    const avant = voies.slice();
    avant[voie] = c.h;

    // Les autres voies qui l'attendaient le rejoignent ici : on les libère.
    const apres = avant.map((h, j) => (h === c.h && j !== voie ? null : h));
    apres[voie] = c.parents[0] ?? null;
    for (const p of c.parents.slice(1)) {
      if (!apres.includes(p)) {
        const libre = apres.indexOf(null);
        if (libre < 0) apres.push(p);
        else apres[libre] = p;
      }
    }
    while (apres.length && apres[apres.length - 1] === null) apres.pop();
    voies = apres;
    return { c, voie, avant, apres };
  });

  // Traits entre une ligne et la suivante. Un trait vise la voie où son
  // commit se posera : la première qui l'attend.
  const branche = (h) => proprietaire.get(h) ?? -1;
  const sortie = lignes.map(({ c, voie, avant, apres }) => {
    const traits = [];
    avant.forEach((h, j) => {
      if (!h || h === c.h) return;
      traits.push([j, apres.indexOf(h), branche(h)]);
    });
    c.parents.forEach((p) => {
      traits.push([voie, apres.indexOf(p), branche(c.h)]);
    });
    // Arrivées sur le commit depuis d'autres voies : traits de la ligne
    // précédente, déjà comptés par elle.
    return {
      h: c.h,
      date: c.date,
      sujet: c.sujet,
      voie,
      branche: branche(c.h),
      etiquettes: etiquettes.get(c.h) ?? [],
      traits,
    };
  });

  // Repli. Une ligne sans événement a un seul parent, aucune étiquette, et
  // tous ses traits droits, y compris ceux qui arrivent d'au-dessus. Dans
  // une suite de telles lignes, les voies ne bougent pas : une seule ligne
  // de traits droits la représente fidèlement.
  const droite = (traits) => traits.every(([a, b]) => a === b);
  const repliee = sortie.map((l, i) =>
    i >= RECENTS &&
    !l.etiquettes.length &&
    commits[i].parents.length === 1 &&
    droite(l.traits) &&
    droite(sortie[i - 1].traits)
  );
  const lignesAffichees = [];
  sortie.forEach((l, i) => {
    if (!repliee[i]) return lignesAffichees.push(l);
    const dernier = lignesAffichees[lignesAffichees.length - 1];
    if (dernier?.pli) {
      dernier.pli += 1;
      dernier.jusqua = l.date;
    } else {
      lignesAffichees.push({ pli: 1, depuis: l.date, jusqua: l.date, traits: l.traits });
    }
  });

  // Rythme : un compte par jour sur tout l'historique, toutes branches.
  const jours = git("log", "--all", "--format=%cs");
  const parJour = {};
  for (const j of jours ? jours.split("\n") : []) parJour[j] = (parJour[j] ?? 0) + 1;

  return {
    total: Object.values(parJour).reduce((a, b) => a + b, 0),
    branches: branches.map((b) => ({
      nom: b.nom,
      distante: b.distante,
      publiee: !!b.publiee,
      suit: b.suit ?? null,
      courante: b.nom === courante,
      date: b.date,
      visible: sortie.some((l) => l.h === b.tete),
    })),
    lignes: lignesAffichees,
    nbVoies: Math.max(1, ...sortie.flatMap((l) => [l.voie + 1, ...l.traits.flatMap(([a, b]) => [a + 1, b + 1])])),
    tronque: commits.length === MAX_COMMITS,
    parJour,
  };
}
