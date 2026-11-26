/**
 * Catalogue transverse : tout ce qui est installé au niveau du compte.
 *
 * Trois questions auxquelles la page répond, et qu'aucune source ne sait
 * traiter seule :
 *   · qu'est-ce qui existe, et est-ce vraiment installé ? (fiches × machine)
 *   · où est-ce branché, et y est-ce actif ?              (× outils des projets)
 *   · qu'en ai-je conclu, et où ?                          (× retours d'usage)
 *
 * Les catégories viennent de l'index `SKILLS.md` : elles disent où c'est rangé.
 * Les domaines, eux, disent à quoi ça sert, d'où deux filtres distincts.
 *
 * S'y ajoute un atelier : cocher des outils pour préparer un set à essayer
 * ensemble. Purement mental : rien n'est installé, rien n'est écrit sur le
 * disque, les sets gardés vivent dans le `localStorage` du navigateur.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Search, FileText, CheckCircle2, CircleDashed, CircleAlert, PackageX,
  FolderOpen, Star, ArrowRight, Plug, Sparkles, Package, FlaskConical,
  Check, X, Layers, Eye, Bookmark,
} from "lucide-react";
import { Pastille } from "../components/primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { LIBELLE_ETAT_OUTIL, TON_ETAT_OUTIL } from "../lib/format.js";

const FILTRES_ETAT = [
  { cle: "tout", libelle: "Tout" },
  { cle: "actif", libelle: "Actifs" },
  { cle: "a-tester", libelle: "À tester" },
  { cle: "declare-seul", libelle: "Déclarés seuls" },
  { cle: "hors-catalogue", libelle: "Hors catalogue" },
  { cle: "branche", libelle: "Branchés sur un projet" },
];

const ICONES = {
  actif: CheckCircle2,
  "installe-a-tester": CircleAlert,
  "a-tester": CircleAlert,
  "declare-seul": CircleDashed,
  catalogue: CircleDashed,
  "hors-catalogue": PackageX,
};

const ICONE_FAMILLE = { mcp: Plug, skills: Sparkles, stack: Package, essai: FlaskConical };
const LIBELLE_FAMILLE = { mcp: "serveur MCP", skills: "skill embarqué", stack: "dépendance", essai: "essai mené" };
const LIBELLE_ETAT_LOCAL = {
  actif: "actif",
  dormant: "dormant",
  "non-approuve": "en attente d'approbation",
  teste: "testé",
};
const TON_ETAT_LOCAL = { actif: "actif", dormant: "pause", "non-approuve": "arbitrage", teste: "accent" };

/**
 * `cle` seule ne suffit pas : un outil peut figurer à la fois dans une fiche et
 * en détection hors catalogue. La catégorie les sépare.
 */
const idOutil = (o) => `${o.categorie}/${o.cle}`;

const CLE_SETS = "pilotoo.sets-outils";

/** Les sets gardés survivent au rechargement, sans jamais toucher au disque. */
function lireSets() {
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE_SETS) ?? "[]");
    return Array.isArray(brut) ? brut.filter((s) => s?.nom && Array.isArray(s.ids)) : [];
  } catch {
    return [];
  }
}

export default function Outils({ etat, aller }) {
  const [filtre, setFiltre] = useState("tout");
  const [domaine, setDomaine] = useState("tout");
  const [q, setQ] = useState("");
  const [selection, setSelection] = useState(() => new Set());
  const [isoler, setIsoler] = useState(false);
  const [replie, setReplie] = useState(false);
  const [sets, setSets] = useState(lireSets);

  const tous = useMemo(() => [...(etat.outils ?? []), ...(etat.outilsOrphelins ?? [])], [etat]);
  const libellesDomaine = etat.domaines ?? {};

  useEffect(() => {
    try {
      window.localStorage.setItem(CLE_SETS, JSON.stringify(sets));
    } catch {
      /* navigation privée, quota : le set reste vivant dans la session. */
    }
  }, [sets]);

  // Isoler la sélection n'a plus de sens dès qu'elle est vide.
  useEffect(() => {
    if (selection.size === 0) setIsoler(false);
  }, [selection]);

  const passeEtat = (o, f) => {
    if (f === "tout") return true;
    if (f === "branche") return (o.nbProjets ?? 0) > 0;
    if (f === "a-tester") return o.etat === "a-tester" || o.etat === "installe-a-tester";
    return o.etat === f;
  };
  const passeDomaine = (o, d) => d === "tout" || (o.domaines ?? []).includes(d);

  const comptesEtat = useMemo(() => {
    const c = {};
    for (const f of FILTRES_ETAT) {
      c[f.cle] = tous.filter((o) => passeEtat(o, f.cle) && passeDomaine(o, domaine)).length;
    }
    return c;
  }, [tous, domaine]);

  const comptesDomaine = useMemo(() => {
    const c = { tout: tous.filter((o) => passeEtat(o, filtre)).length };
    for (const d of Object.keys(libellesDomaine)) {
      c[d] = tous.filter((o) => passeEtat(o, filtre) && passeDomaine(o, d)).length;
    }
    return c;
  }, [tous, filtre, libellesDomaine]);

  const choisis = useMemo(() => tous.filter((o) => selection.has(idOutil(o))), [tous, selection]);

  // Isoler court-circuite les filtres : un outil coché ne doit jamais disparaître
  // derrière un filtre laissé en place.
  const visibles = useMemo(() => {
    if (isoler) return choisis;
    const terme = q.trim().toLowerCase();
    return tous.filter((o) => {
      if (!passeEtat(o, filtre) || !passeDomaine(o, domaine)) return false;
      if (!terme) return true;
      return [o.nom, o.tldr, o.fonction, o.type, o.categorie, ...(o.presence ?? []).map((p) => p.projet)]
        .join(" ")
        .toLowerCase()
        .includes(terme);
    });
  }, [tous, filtre, domaine, q, isoler, choisis]);

  const parCategorie = useMemo(() => {
    const m = new Map();
    for (const o of visibles) {
      if (!m.has(o.categorie)) m.set(o.categorie, []);
      m.get(o.categorie).push(o);
    }
    return [...m.entries()];
  }, [visibles]);

  const basculer = (o) =>
    setSelection((s) => {
      const n = new Set(s);
      const id = idOutil(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className={`mx-auto max-w-[1200px] px-8 py-8 ${choisis.length ? (replie ? "pb-20" : "pb-56") : ""}`}>
      <header className="mb-9">
        <p className="t-surtitre">Bibliothèque « Skills-Lib »</p>
        <h1 className="t-display mt-2">Outils</h1>
        <p className="t-chapo mt-3 max-w-3xl">
          Le catalogue déclaré dans <code className="rounded bg-fond-3 px-1 py-0.5 text-[12px]">SKILLS.md</code>, croisé
          avec ce qui est réellement installé, avec les projets qui l'embarquent, et avec ce que tu en as conclu. Un
          outil « déclaré seul » existe dans une fiche mais n'a pas été trouvé sur cette machine : normal pour les
          outils Cowork et les connecteurs OAuth, suspect pour le reste.
        </p>
      </header>

      <div className="mb-5 relative w-72">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texte-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un outil, un projet…"
          aria-label="Rechercher un outil"
          className="w-full rounded-lg border border-bord bg-fond-2 py-1.5 pl-9 pr-3 text-[12px] text-texte placeholder:text-texte-3 focus:border-accent/50 focus:outline-none"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-texte-3">Domaine</span>
        <Chip actif={domaine === "tout"} onClick={() => setDomaine("tout")} compte={comptesDomaine.tout}>
          Tous
        </Chip>
        {Object.entries(libellesDomaine)
          .filter(([cle]) => comptesDomaine[cle] > 0 || domaine === cle)
          .map(([cle, libelle]) => (
            <Chip key={cle} actif={domaine === cle} onClick={() => setDomaine(cle)} compte={comptesDomaine[cle]}>
              {libelle}
            </Chip>
          ))}
      </div>

      <div className="mb-7 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-texte-3">État</span>
        {FILTRES_ETAT.map((f) => (
          <Chip key={f.cle} actif={filtre === f.cle} onClick={() => setFiltre(f.cle)} compte={comptesEtat[f.cle]}>
            {f.libelle}
          </Chip>
        ))}
      </div>

      {sets.length > 0 && (
        <div className="mb-7 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-texte-3">Sets gardés</span>
          {sets.map((s) => (
            <SetGarde
              key={s.nom}
              set={s}
              charger={() => setSelection(new Set(s.ids))}
              oublier={() => setSets((prev) => prev.filter((x) => x.nom !== s.nom))}
            />
          ))}
        </div>
      )}

      {parCategorie.length === 0 && <p className="text-sm text-texte-3">Aucun outil ne correspond.</p>}

      <div className="space-y-8">
        {parCategorie.map(([categorie, items]) => (
          <section key={categorie}>
            <h2 className="t-h2 mb-4 flex items-center gap-3">
              <span className="h-6 w-1 shrink-0 rounded-full bg-vert" aria-hidden="true" />
              {categorie}
              <span className="tabulaire rounded-full bg-vert-pale px-2.5 py-0.5 font-sans text-[13px] font-bold text-actif">
                {items.length}
              </span>
            </h2>
            <div className="border-b border-bord/70">
              {items.map((o) => (
                <FicheOutil
                  key={idOutil(o)}
                  o={o}
                  aller={aller}
                  libelles={libellesDomaine}
                  choisi={selection.has(idOutil(o))}
                  basculer={() => basculer(o)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {choisis.length > 0 && (
        <Atelier
          choisis={choisis}
          replie={replie}
          basculerReplie={() => setReplie((v) => !v)}
          libelles={libellesDomaine}
          retirer={(o) => basculer(o)}
          vider={() => setSelection(new Set())}
          isoler={isoler}
          basculerIsoler={() => setIsoler((v) => !v)}
          garder={(nom) =>
            setSets((prev) => [{ nom, ids: [...selection] }, ...prev.filter((s) => s.nom !== nom)].slice(0, 12))
          }
        />
      )}
    </div>
  );
}

function Chip({ actif, onClick, compte, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
        actif
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-bord bg-fond-2 text-texte-2 hover:border-bord-vif hover:text-texte"
      }`}
    >
      {children}
      {compte != null && <span className="tabulaire text-[11px] opacity-60">{compte}</span>}
    </button>
  );
}

/** Un set gardé : le nom rappelle la sélection, la croix l'oublie. */
function SetGarde({ set, charger, oublier }) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-bord bg-fond-2 pl-3 pr-1 text-[12px] text-texte-2 transition hover:border-bord-vif">
      <button onClick={charger} className="py-1.5 font-medium transition hover:text-texte">
        {set.nom}
        <span className="tabulaire ml-2 text-[11px] opacity-60">{set.ids.length}</span>
      </button>
      <button
        onClick={oublier}
        aria-label={`Oublier le set ${set.nom}`}
        className="rounded p-1 text-texte-3 transition hover:bg-fond-3 hover:text-bloque"
      >
        <X size={11} strokeWidth={2.4} />
      </button>
    </span>
  );
}

/**
 * Case à cocher d'un outil. Elle vit dans le `summary` : sans couper
 * l'évènement, chaque cochage déplierait la fiche.
 */
function CaseChoix({ choisi, basculer, nom }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        basculer();
      }}
      aria-pressed={choisi}
      aria-label={`${choisi ? "Retirer" : "Ajouter"} ${nom} du set en préparation`}
      title={choisi ? "Retirer du set" : "Ajouter au set"}
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
        choisi
          ? "border-accent bg-accent/15 text-accent opacity-100"
          : "border-bord-vif text-transparent opacity-0 hover:border-accent/60 hover:text-accent/40 focus-visible:opacity-100 group-hover:opacity-100"
      }`}
    >
      <Check size={11} strokeWidth={3} />
    </button>
  );
}

/**
 * L'atelier : la barre qui accompagne un set en préparation.
 *
 * Elle ne fait rien qu'afficher. Son intérêt est la lecture du spectre : un
 * domaine couvert par un seul outil du set est un complément, un domaine
 * couvert par plusieurs est un recouvrement : deux outils qui se marchent
 * dessus. C'est ce qu'on cherche à voir avant de monter un essai.
 */
function Atelier({ choisis, libelles, retirer, vider, isoler, basculerIsoler, garder, replie, basculerReplie }) {
  const [nom, setNom] = useState("");

  const spectre = useMemo(() => {
    const m = new Map();
    for (const o of choisis) for (const d of o.domaines ?? []) m.set(d, (m.get(d) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [choisis]);

  const complements = spectre.filter(([, n]) => n === 1).length;
  const recouvrements = spectre.length - complements;
  const sansDomaine = choisis.filter((o) => !(o.domaines ?? []).length).length;
  const absents = choisis.filter((o) => o.etat === "declare-seul").length;

  const nommer = () => {
    const propre = nom.trim();
    if (!propre) return;
    garder(propre);
    setNom("");
  };

  // La barre se centre sur la colonne de contenu, pas sur la fenêtre : le menu
  // fait 200 px et ne se rétracte pas, donc la bande part de son bord droit.
  // `pointer-events-none` sur la bande : elle garde sa hauteur de boîte même
  // tiroir fermé, et intercepterait les clics sur la fin de la liste.
  return (
    <div className="pointer-events-none fixed bottom-0 left-[200px] right-0 z-40 flex justify-center px-8">
      {/* Le tiroir coulisse d'une hauteur de poignée : replié, seul le galet
          dépasse de la bordure basse. Le déplacement est en style inline, pas en
          classe : Tailwind v4 passe par la propriété `translate` et un
          `@property` typé qui rejette `calc(100% - 2rem)` : la règle est
          écrite mais jamais appliquée. En `transform` inline, le pourcentage se
          réfère bien à la hauteur de l'élément, quel que soit le nombre
          d'outils. */}
      <div
        className="pointer-events-auto w-[min(900px,100%)] pb-5 transition-transform duration-300 ease-out"
        style={{ transform: replie ? "translateY(calc(100% - 2rem))" : "translateY(0)" }}
      >
        {/* Une seule bulle : la poignée est un galet que le contour du panneau
            absorbe. Trois pièces de la même couleur opaque (le galet, le
            panneau, et deux congés de 10 px à la jonction) dont l'union forme
            la silhouette. Les congés sont des carrés au fond en
            `radial-gradient` : plein partout sauf un quart de disque, soit
            exactement l'arc rentrant qu'aucun `border-radius` ne sait tracer.
            Le liséré clair et les ombres passent en `filter` sur ce conteneur :
            un `drop-shadow` épouse la silhouette réunie, donc le trait du haut
            suit la bosse et les congés d'un seul trait. Une `border` ne saurait
            pas, et deux surfaces translucides laisseraient voir leur
            recouvrement, d'où l'opacité pleine, sans verre dépoli.

            En clair, la surface est blanche (`fond-2`) au-dessus du fond slate de
            la page ; le liséré du haut devient un trait sombre très léger et les
            ombres prennent l'encre slate au lieu du noir. */}
        <div
          className="relative"
          style={{
            filter: [
              "drop-shadow(0 -1px 0 rgb(15 23 42 / 0.08))",
              "drop-shadow(0 2px 4px rgb(15 23 42 / 0.08))",
              "drop-shadow(0 18px 40px rgb(15 23 42 / 0.14))",
              "drop-shadow(0 0 12px rgb(0 149 133 / 0.14))",
            ].join(" "),
          }}
        >
          <button
            onClick={basculerReplie}
            aria-expanded={!replie}
            aria-controls="atelier-set"
            aria-label={replie ? "Rouvrir le set en préparation" : "Ranger le set en bordure d'écran"}
            title={replie ? "Rouvrir le set" : "Ranger le set en bordure d'écran"}
            className="mx-auto -mb-3.5 flex h-8 w-60 cursor-grab items-start justify-center rounded-full bg-fond-2 pt-[7px] focus:outline-none active:cursor-grabbing hover:[&>span]:bg-accent/70 focus-visible:[&>span]:bg-accent"
          >
            <span className="h-[4px] w-28 rounded-full bg-bord-vif shadow-[inset_0_1px_1px_rgb(15_23_42_/_0.12)] transition-colors" />
          </button>
          {/* Les deux congés, de part et d'autre du galet, sur l'arête du panneau. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2 h-2.5 w-2.5"
            style={{
              right: "calc(50% + 7.5rem)",
              background: "radial-gradient(circle 10px at 0 0, #0000 9.5px, var(--color-fond-2) 10px)",
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2 h-2.5 w-2.5"
            style={{
              left: "calc(50% + 7.5rem)",
              background: "radial-gradient(circle 10px at 100% 0, #0000 9.5px, var(--color-fond-2) 10px)",
            }}
          />
          {/* Poussé hors écran, le panneau resterait tabulable : `inert` le retire
              du focus. React 18 ne connaît pas encore le booléen, d'où la chaîne. */}
          <div
            id="atelier-set"
            inert={replie ? "" : undefined}
            className="relative max-h-[46vh] space-y-3 overflow-y-auto rounded-2xl bg-fond-2 px-4 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <Layers size={15} className="shrink-0 text-accent" strokeWidth={2} />
              <span className="text-[13px] font-medium text-texte">
                Set en préparation
                <span className="tabulaire ml-2 text-[12px] text-texte-3">
                  {choisis.length} outil{choisis.length > 1 ? "s" : ""}
                </span>
              </span>
              <button
                onClick={basculerIsoler}
                aria-pressed={isoler}
                className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  isoler
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-bord-vif text-texte-2 hover:border-accent/40 hover:text-texte"
                }`}
              >
                <Eye size={12} strokeWidth={2} />
                {isoler ? "Tout revoir" : "Voir le set seul"}
              </button>
              <button
                onClick={vider}
                className="rounded-lg border border-bord-vif px-2.5 py-1 text-[11px] text-texte-2 transition hover:border-bloque/40 hover:text-bloque"
              >
                Vider
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {choisis.map((o) => (
                <span
                  key={idOutil(o)}
                  className="flex items-center gap-1 rounded-lg border border-bord bg-fond-2 px-2 py-1 text-[12px] text-texte"
                >
                  {o.nom}
                  <button
                    onClick={() => retirer(o)}
                    aria-label={`Retirer ${o.nom}`}
                    className="rounded p-0.5 text-texte-3 transition hover:text-bloque"
                  >
                    <X size={11} strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>

            {spectre.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-texte-3">
                  Spectre couvert
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {spectre.map(([d, n]) => (
                    <Pastille key={d} ton={n > 1 ? "pause" : "accent"}>
                      {libelles[d] ?? d}
                      {n > 1 && <span className="tabulaire opacity-70">×{n}</span>}
                    </Pastille>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-texte-3">
                  {complements} domaine{complements > 1 ? "s" : ""} tenu{complements > 1 ? "s" : ""} par un seul outil
                  {recouvrements > 0
                    ? `, ${recouvrements} en recouvrement : deux outils du set s'y croisent.`
                    : " : aucun recouvrement, le set est franchement complémentaire."}
                  {sansDomaine > 0 && ` ${sansDomaine} sans domaine déclaré.`}
                  {absents > 0 &&
                    ` ${absents} déclaré${absents > 1 ? "s" : ""} seul${absents > 1 ? "s" : ""} : à installer avant d'essayer.`}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-bord pt-3">
              <Bookmark size={13} className="shrink-0 text-texte-3" strokeWidth={2} />
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && nommer()}
                placeholder="Nommer ce set pour le retrouver…"
                aria-label="Nom du set"
                className="w-64 rounded-lg border border-bord bg-fond-2 px-3 py-1.5 text-[12px] text-texte placeholder:text-texte-3 focus:border-accent/50 focus:outline-none"
              />
              <button
                onClick={nommer}
                disabled={!nom.trim()}
                className="rounded-lg border border-bord-vif bg-fond-2 px-2.5 py-1.5 text-[11px] font-medium text-texte-2 transition hover:border-accent/40 hover:text-accent disabled:opacity-40 disabled:hover:border-bord-vif disabled:hover:text-texte-2"
              >
                Garder
              </button>
              <span className="ml-auto text-[11px] text-texte-3">Aucun effet : rien n'est installé ni écrit.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function FicheOutil({ o, aller, libelles, choisi, basculer }) {
  const Icone = ICONES[o.etat] ?? CircleDashed;
  const ton = TON_ETAT_OUTIL[o.etat] ?? "termine";
  const teintes = { actif: "text-actif", pause: "text-pause", arbitrage: "text-arbitrage", termine: "text-texte-3" };
  const conclusions = (o.retours ?? []).filter((r) => !/pas encore test|non test/i.test(r.texte));

  return (
    <details className="group border-t border-bord/70">
      <summary
        className={`flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 transition ${
          choisi ? "bg-accent/[0.06] hover:bg-accent/10" : "hover:bg-fond-2"
        }`}
      >
        <CaseChoix choisi={choisi} basculer={basculer} nom={o.nom} />
        <Icone size={16} className={`mt-0.5 shrink-0 ${teintes[ton]}`} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[14px] font-medium text-texte">{o.nom}</span>
            {o.type && <span className="text-[11px] text-texte-3">{o.type}</span>}
          </div>
          {o.tldr && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-texte-2">{o.tldr}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {o.nbProjets > 0 && (
              <span className="text-accent">
                branché sur {o.nbProjets} projet{o.nbProjets > 1 ? "s" : ""}
              </span>
            )}
            {conclusions.length > 0 && (
              <span className="text-actif">
                {conclusions.length} conclusion{conclusions.length > 1 ? "s" : ""}
              </span>
            )}
            {o.ecart && <span className={teintes[ton]}>{o.ecart}</span>}
          </div>
        </div>
        <Pastille ton={ton} className="mt-0.5 shrink-0">
          {LIBELLE_ETAT_OUTIL[o.etat] ?? o.etat}
        </Pastille>
      </summary>

      <div className="space-y-4 border-t border-bord/40 px-4 py-4 pl-[4.05rem] text-[12.5px] leading-relaxed">
        {o.fonction && (
          <p className="text-texte-2">
            <strong className="font-semibold text-texte">Fonction. </strong>
            {o.fonction}
          </p>
        )}
        {o.declencheurs && (
          <p className="text-texte-2">
            <strong className="font-semibold text-texte">Déclencheurs. </strong>
            {o.declencheurs}
          </p>
        )}
        {o.pieges && (
          <p className="text-texte-2">
            <strong className="font-semibold text-texte">Pièges. </strong>
            {o.pieges}
          </p>
        )}

        <Presence presence={o.presence} aller={aller} />
        <Conclusions conclusions={conclusions} />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {(o.domaines ?? []).map((d) => (
            <span key={d} className="rounded bg-fond-3 px-2 py-0.5 text-[11px] text-texte-3">
              {libelles[d] ?? d}
            </span>
          ))}
          {o.canaux?.map((c) => (
            <Pastille key={c} ton="accent">
              détecté : {c}
            </Pastille>
          ))}
          {o.ou?.map((d) => (
            <span key={d} className="rounded bg-fond-3 px-2 py-0.5 font-mono text-[11px] text-texte-3">
              {d}
            </span>
          ))}
          {o.maj && <span className="text-[11px] text-texte-3">fiche vérifiée {o.maj}</span>}
          {o.lienFiche && (
            <button
              onClick={() => ouvrir(o.lienFiche.uri)}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-bord px-2.5 py-1 text-[11px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
            >
              <FileText size={12} strokeWidth={2} className="text-arbitrage" />
              Ouvrir la fiche
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

/** Où l'outil est branché, et dans quel état il s'y trouve. */
function Presence({ presence, aller }) {
  if (!presence?.length) {
    return (
      <p className="text-[12px] text-texte-3">
        Branché sur aucun projet suivi. S'il est installé au niveau du compte, il reste utilisable partout.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-texte-3">Où il est branché</div>
      <div className="space-y-1.5">
        {presence.map((p, i) => {
          const IconeF = ICONE_FAMILLE[p.famille] ?? Package;
          return (
            <button
              key={i}
              onClick={() => aller?.({ vue: "projet", id: p.projetId, onglet: p.famille === "essai" ? "essais" : "outils" })}
              className="flex w-full items-center gap-2.5 rounded-lg bg-fond-2 px-3 py-2 text-left transition hover:bg-fond-3"
            >
              <IconeF size={13} className="shrink-0 text-texte-3" strokeWidth={2} />
              <FolderOpen size={12} className="shrink-0 text-texte-3" strokeWidth={2} />
              <span className="text-[12.5px] text-texte">{p.projet}</span>
              <span className="text-[11px] text-texte-3">{LIBELLE_FAMILLE[p.famille] ?? p.famille}</span>
              <Pastille ton={TON_ETAT_LOCAL[p.etat] ?? "termine"}>
                {LIBELLE_ETAT_LOCAL[p.etat] ?? p.etat}
              </Pastille>
              {p.famille === "essai" && (
                <>
                  {p.note != null && (
                    <Pastille ton="accent">
                      <Star size={10} strokeWidth={2.6} />
                      {p.note}/5
                    </Pastille>
                  )}
                  <Pastille ton={p.reporte ? "actif" : "bloque"}>
                    {p.reporte ? "reporté" : "non reporté"}
                  </Pastille>
                </>
              )}
              <ArrowRight size={12} className="ml-auto shrink-0 text-texte-3" strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ce que j'en ai conclu, archivé dans la fiche par « Skills-Lib ». */
function Conclusions({ conclusions }) {
  if (!conclusions.length) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-texte-3">
        Conclusions archivées
      </div>
      <ul className="space-y-2">
        {conclusions.map((r, i) => (
          <li key={i} className="border-l-2 border-l-actif/50 pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabulaire text-[11px] font-medium text-actif">{r.date}</span>
              {r.projet && <span className="text-[11px] text-texte-3">{r.projet}</span>}
              {r.note != null && (
                <Pastille ton="accent">
                  <Star size={10} strokeWidth={2.6} />
                  {r.note}/5
                </Pastille>
              )}
              {r.issue && <Pastille ton={r.issue === "retenu" ? "actif" : "pause"}>{r.issue}</Pastille>}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-texte-2">{r.texte}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
