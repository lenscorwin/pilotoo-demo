/**
 * Bilan d'outillage d'un projet : pour chaque outil, ce qui est constaté
 * (appels dans l'historique des sessions), testé (banc d'essai), évalué
 * (retours d'usage des fiches) et dit (phrases de Lois qui le citent).
 *
 * La question à laquelle il répond : qu'est-ce qui attend un retour de ma part ?
 * Un outil utilisé sans retour dans sa fiche « attend une évaluation » ; un
 * retour posé sans note « attend une note » ; un outil utilisé sans fiche
 * « attend une fiche ». Rien n'est jamais déduit au-delà : pas de note
 * inventée, pas de verdict supposé.
 */
import { normaliser } from "./markdown.mjs";
import { joursDepuis } from "./fs-probe.mjs";
import { premierEtDerniers } from "./usage.mjs";
import { nomLisible } from "./skills-lisibles.mjs";

/** Seuil d'appels sous lequel un usage ne réclame rien : un appel MCP isolé n'est pas un essai. */
const SEUILS_APPELS = { skill: 1, commande: 1, agent: 1, mcp: 3, cli: 3 };

export function construireBilan({ usage, banc, catalogue, alias, agentsProjet, stack = [], seuils = {} }) {
  const cles = new Set(alias.map(normaliser).filter(Boolean));
  const deCeProjet = (r) => cles.has(normaliser(r.projet ?? ""));
  const parCle = new Map(catalogue.map((o) => [o.cle, o]));
  const joursInactif = seuils.joursAvantOutilInactif ?? 21;
  const nomsAgents = new Set((agentsProjet ?? []).map((a) => a.nom));

  const sujets = new Map();
  const sujet = (cle, init) => {
    if (!sujets.has(cle)) {
      const fiche = parCle.get(cle) ?? null;
      sujets.set(cle, {
        cle,
        nom: fiche?.nom ?? init.nom,
        famille: init.famille,
        fiche: fiche ? { nom: fiche.nom, lien: fiche.lienFiche, statut: fiche.statutDeclare } : null,
        composants: [],
        appels: 0,
        du: null,
        au: null,
        contextes: [],
        essai: null,
        retours: [],
        avis: [],
      });
    }
    return sujets.get(cle);
  };

  // 1. Ce qui a été appelé.
  for (const o of usage?.outils ?? []) {
    const s = sujet(o.fiche?.cle ?? o.cle, o);
    s.composants.push({ nom: o.nom, lisible: o.famille === "skill" ? nomLisible(o.nom) : null, famille: o.famille, appels: o.appels, du: o.du, au: o.au });
    s.appels += o.appels;
    if (o.du && (!s.du || o.du < s.du)) s.du = o.du;
    if (o.au && (!s.au || o.au > s.au)) s.au = o.au;
    for (const c of o.contextes) if (!s.contextes.some((x) => x.texte === c.texte)) s.contextes.push({ ...c, via: o.nom });
    if (o.famille === "agent" || nomsAgents.has(o.nom)) s.famille = "agent";
    if (o.maison) s.famille = "commande-projet";
  }

  // 1 bis. Ce qui est dans le code : une dépendance qui a sa fiche est un
  // outil en usage, même si aucune session ne l'a appelé par son nom.
  for (const d of stack) {
    const s = sujet(d.cle, { nom: d.nom, famille: "stack" });
    s.composants.push({ nom: `${d.nom} ${d.version ?? ""}`.trim(), famille: "stack", appels: 0 });
    s.dansLeCode = true;
  }

  // 2. Ce qui a été testé au banc, même hors de la fenêtre d'historique.
  for (const e of banc?.essais ?? []) {
    if (!e.teste) continue;
    // Le skill testé peut déjà vivre sous la fiche de sa famille
    // (`improve-animations` sous `emil-kowalski-skills`) : il la rejoint.
    const hote = [...sujets.values()].find((x) => x.composants.some((c) => normaliser(c.nom) === normaliser(e.nom)));
    const s = hote ?? sujet(e.cle, { nom: e.nom, famille: "skill" });
    s.essai = { date: e.date, surQuoi: e.surQuoi, verdict: e.verdict, issue: e.issue, note: e.note, reporte: e.reporte, lien: e.lien };
  }

  // 3. Ce que les fiches disent de ce projet-ci.
  for (const o of catalogue) {
    const retours = (o.retours ?? []).filter(deCeProjet);
    if (!retours.length) continue;
    const evaluations = retours.filter((r) => !estSimpleInstallation(r));
    // Une ligne « installé, pas encore testé » ne crée pas de sujet à elle seule.
    if (!evaluations.length && !sujets.has(o.cle)) continue;
    const s = sujet(o.cle, { nom: o.nom, famille: "skill" });
    s.retours = retours.map((r) => ({ ...r, installation: estSimpleInstallation(r) }));
  }

  // 4. Ce que Lois en a dit, mot pour mot.
  for (const p of usage?.paroles ?? []) {
    const texte = normaliser(p.texte);
    for (const s of sujets.values()) {
      const noms = new Set([s.nom, s.cle, ...s.composants.map((c) => c.nom)].map((n) => normaliser(n)).filter((n) => n.length >= 4));
      if ([...noms].some((n) => (" " + texte + " ").includes(" " + n))) s.avis.push({ date: p.date, texte: p.texte });
    }
  }

  const liste = [...sujets.values()].map((s) => qualifier(s, joursInactif));
  const attente = liste.filter((s) => s.attente);

  return {
    sujets: liste.sort(ordre),
    resume: {
      total: liste.length,
      notes: liste.filter((s) => s.evaluation === "note").length,
      aEvaluer: liste.filter((s) => s.evaluation === "a-evaluer").length,
      noteManquante: liste.filter((s) => s.evaluation === "note-manquante").length,
      ficheManquante: liste.filter((s) => s.evaluation === "fiche-manquante").length,
      aReporter: liste.filter((s) => s.evaluation === "a-reporter").length,
      avecAvis: attente.filter((s) => s.avis.length).length,
      plusUtilises: liste.filter((s) => s.activite === "ancien" || s.activite === "ecarte").length,
      attente: attente.length,
    },
    fenetre: { du: usage?.du ?? null, au: usage?.au ?? null, sessions: usage?.sessions ?? 0, purgees: usage?.sessionsPurgees ?? 0 },
  };

  function qualifier(s, jours) {
    const evaluations = s.retours.filter((r) => !r.installation);
    const noteRetour = evaluations.find((r) => r.note != null);
    const issue = evaluations.find((r) => r.issue)?.issue ?? s.essai?.issue ?? null;
    const seuil = Math.min(...s.composants.map((c) => SEUILS_APPELS[c.famille] ?? 1), 99);
    const significatif = s.appels >= seuil || !!s.essai || !!s.dansLeCode;

    let evaluation;
    if (s.famille === "agent" || s.famille === "commande-projet") evaluation = "maison";
    else if (noteRetour) evaluation = "note";
    else if (evaluations.some((r) => r.issue)) evaluation = "note-manquante";
    else if (evaluations.length) evaluation = "retour-libre";
    else if (s.essai?.date && s.essai.issue && s.essai.issue !== "sans-verdict" && !s.essai.reporte) evaluation = "a-reporter";
    else if (!significatif) evaluation = "ponctuel";
    else if (!s.fiche) evaluation = "fiche-manquante";
    else evaluation = "a-evaluer";

    let activite;
    if (issue === "ecarte") activite = "ecarte";
    else if (s.dansLeCode) activite = "en-place";
    else if (!s.au) activite = "hors-historique";
    else activite = (joursDepuis(s.au) ?? 0) > jours ? "ancien" : "recent";

    const attente = ["a-evaluer", "note-manquante", "fiche-manquante", "a-reporter"].includes(evaluation);
    return {
      ...s,
      contextes: premierEtDerniers(s.contextes),
      avis: dedoublonner(s.avis).slice(-4),
      note: noteRetour?.note ?? s.essai?.note ?? null,
      issue,
      evaluation,
      activite,
      attente,
    };
  }
}

/** Les attentes d'abord, puis l'activité récente. */
function ordre(a, b) {
  const rang = { "a-reporter": 0, "a-evaluer": 1, "fiche-manquante": 2, "note-manquante": 3 };
  const ra = rang[a.evaluation] ?? 9;
  const rb = rang[b.evaluation] ?? 9;
  if (ra !== rb) return ra - rb;
  return String(b.au ?? b.essai?.date ?? "").localeCompare(String(a.au ?? a.essai?.date ?? ""));
}

function estSimpleInstallation(r) {
  return /pas encore test|non test|install[ée].{0,80}dormant/i.test(r.texte ?? "") && r.note == null && !r.issue;
}

function dedoublonner(avis) {
  const vus = new Set();
  return avis.filter((a) => (vus.has(a.texte) ? false : vus.add(a.texte)));
}

