/**
 * Fenêtres simulées de la démo : ce qui s'ouvre à la place d'Obsidian ou du
 * Finder quand on clique « ouvrir ».
 *
 * `ouvrir(uri)` (lib/api.js) émet `pilotoo:ouvrir` en démo ; ce composant
 * l'écoute. Un fichier markdown s'ouvre dans une fenêtre Obsidian, un dossier
 * dans une fenêtre Finder. Les fenêtres se déplacent par leur barre de titre,
 * se referment par la pastille rouge ou Échap, et passent devant au clic.
 *
 * Les couleurs imitent les deux applications : elles ne suivent pas le thème
 * du dashboard, comme de vraies fenêtres posées par-dessus.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Folder, FileText, FileCode2, Search, Files, Network,
  Clock, HardDrive, Monitor, Download, LayoutList, ChevronDown, Lock,
} from "lucide-react";
import {
  chargerCatalogue, trouver, enfant, voisins, racineDe, cheminDansRacine,
  resoudreLien, separerFrontmatter, rendreMarkdown,
} from "../lib/fichiers.js";

const TAILLES = { obsidian: [900, 620], finder: [780, 460], absent: [420, 220] };
let compteur = 0;

/** Choisit l'habillage d'une entrée du catalogue. */
const habillage = (f) => (!f || f.type === "absent" || f.type === "autre" ? "absent" : f.type === "dossier" ? "finder" : "obsidian");

export default function Fenetres() {
  const [fenetres, setFenetres] = useState([]);

  const ouvrirFenetre = useCallback(async (uri) => {
    await chargerCatalogue();
    const f = trouver(uri);
    const app = habillage(f);
    setFenetres((liste) => {
      // Déjà ouverte : on la ramène devant au lieu d'en ouvrir une seconde.
      const deja = liste.find((w) => w.historique[w.position] === (f?.uri ?? uri));
      if (deja) return [...liste.filter((w) => w !== deja), deja];
      const [l, h] = TAILLES[app];
      const decalage = (liste.length % 6) * 28;
      const x = Math.max(16, Math.min(window.innerWidth - l - 16, (window.innerWidth - l) / 2 + decalage));
      const y = Math.max(16, Math.min(window.innerHeight - h - 16, (window.innerHeight - h) / 2.6 + decalage));
      return [...liste, { id: ++compteur, app, x, y, l, h, historique: [f?.uri ?? uri], position: 0 }];
    });
  }, []);

  useEffect(() => {
    const surOuvrir = (e) => ouvrirFenetre(e.detail.uri);
    // Échap ne ferme que si le focus est dans une fenêtre : ailleurs, la touche
    // garde son rôle habituel dans le dashboard.
    const surTouche = (e) => {
      if (e.key !== "Escape") return;
      const dans = document.activeElement?.closest?.("section[data-fenetre]");
      if (!dans) return;
      const id = Number(dans.dataset.fenetre);
      setFenetres((liste) => liste.filter((w) => w.id !== id));
    };
    window.addEventListener("pilotoo:ouvrir", surOuvrir);
    window.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("pilotoo:ouvrir", surOuvrir);
      window.removeEventListener("keydown", surTouche);
    };
  }, [ouvrirFenetre]);

  const maj = (id, f) => setFenetres((liste) => liste.map((w) => (w.id === id ? { ...w, ...f(w) } : w)));
  const fermer = (id) => setFenetres((liste) => liste.filter((w) => w.id !== id));
  const devant = (id) =>
    setFenetres((liste) => {
      const w = liste.find((x) => x.id === id);
      return w && liste.at(-1) !== w ? [...liste.filter((x) => x !== w), w] : liste;
    });

  /** Navigation interne (dossier → sous-dossier, lien [[wiki]]) dans la même fenêtre. */
  const naviguer = (id, uri) =>
    setFenetres((liste) => {
      // Une autre fenêtre montre déjà cette fiche : on la ramène devant.
      const autre = liste.find((w) => w.id !== id && w.historique[w.position] === uri);
      if (autre) return [...liste.filter((w) => w !== autre), autre];
      return liste.map((w) =>
        w.id === id ? { ...w, historique: [...w.historique.slice(0, w.position + 1), uri], position: w.position + 1 } : w,
      );
    });

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]">
      {fenetres.map((w, i) => (
        <Fenetre
          key={w.id}
          w={w}
          auPremierPlan={i === fenetres.length - 1}
          z={i}
          fermer={() => fermer(w.id)}
          devant={() => devant(w.id)}
          deplacer={(x, y) => maj(w.id, () => ({ x, y }))}
          naviguer={(uri) => naviguer(w.id, uri)}
          reculer={() => maj(w.id, (x) => ({ position: Math.max(0, x.position - 1) }))}
          avancer={() => maj(w.id, (x) => ({ position: Math.min(x.historique.length - 1, x.position + 1) }))}
          ouvrirAilleurs={ouvrirFenetre}
        />
      ))}
    </div>
  );
}

function Fenetre({ w, auPremierPlan, z, fermer, devant, deplacer, naviguer, reculer, avancer, ouvrirAilleurs }) {
  const ref = useRef(null);
  const f = trouver(w.historique[w.position]);
  const titre = f?.titre ?? "Fichier";

  // Le focus suit la fenêtre qui passe au premier plan : Échap et Tab agissent sur elle.
  useEffect(() => {
    if (auPremierPlan && !ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
  }, [auPremierPlan]);

  /** Déplacement par la barre de titre, borné à l'écran. */
  const saisir = (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    devant();
    const dx = e.clientX - w.x;
    const dy = e.clientY - w.y;
    const bouger = (ev) =>
      deplacer(
        Math.max(-w.l + 120, Math.min(window.innerWidth - 120, ev.clientX - dx)),
        Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy)),
      );
    const lacher = () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", lacher);
      window.removeEventListener("pointercancel", lacher);
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", lacher);
    window.addEventListener("pointercancel", lacher);
  };

  const sombre = w.app === "obsidian";
  const props = { f, naviguer, ouvrirAilleurs, saisir, fermer, titre, w, reculer, avancer };

  return (
    <section
      ref={ref}
      tabIndex={-1}
      data-fenetre={w.id}
      role="dialog"
      aria-label={`${w.app === "finder" ? "Finder" : w.app === "obsidian" ? "Obsidian" : "Fichier"} : ${titre}`}
      onPointerDown={devant}
      style={{ left: w.x, top: w.y, width: w.l, height: w.h, zIndex: z }}
      className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-[12px] outline-none transition-shadow ${
        sombre ? "border border-black/60 bg-[#1e1e1e] text-[#dcddde]" : "border border-black/15 bg-white text-[#1d1d1f]"
      } ${auPremierPlan ? "shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)]" : "shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]"}`}
    >
      {w.app === "obsidian" && <Obsidian {...props} />}
      {w.app === "finder" && <Finder key={f?.uri} {...props} />}
      {w.app === "absent" && <Absent {...props} />}
    </section>
  );
}

/** Les trois pastilles macOS. Seule la rouge agit. */
function Pastilles({ fermer, titre }) {
  return (
    <div className="flex items-center gap-2 pl-3.5">
      <button
        type="button"
        onClick={fermer}
        aria-label={`Fermer ${titre}`}
        className="group grid size-3 place-items-center rounded-full bg-[#ff5f57] ring-1 ring-black/10"
      >
        <span aria-hidden className="text-[9px] leading-none text-black/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          ×
        </span>
      </button>
      <span aria-hidden className="size-3 rounded-full bg-[#febc2e] ring-1 ring-black/10" />
      <span aria-hidden className="size-3 rounded-full bg-[#28c840] ring-1 ring-black/10" />
    </div>
  );
}

// ───────────────────────────────── Obsidian ─────────────────────────────────

function Obsidian({ f, naviguer, saisir, fermer, titre }) {
  const contenu = useRef(null);
  const racine = racineDe(f);
  // Mémorisé par fiche : déplacer la fenêtre ne recalcule ni l'arbre ni le rendu.
  const arbre = useMemo(() => construireArbre(voisins(f)), [f]);
  const { proprietes, corps, html, mots } = useMemo(() => {
    const { proprietes: p, corps: c } = separerFrontmatter(f.contenu ?? "");
    return { proprietes: p, corps: c, html: rendreMarkdown(c), mots: c.split(/\s+/).filter(Boolean).length };
  }, [f]);

  // Les liens [[wiki]] ouvrent la fiche dans la même fenêtre ; les liens web, un onglet.
  const surClic = (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("wiki:")) {
      e.preventDefault();
      const cible = resoudreLien(decodeURIComponent(href.slice(5)), f);
      if (cible) naviguer(cible.uri);
    } else if (/^https?:/.test(href)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      e.preventDefault();
    }
  };

  useEffect(() => {
    contenu.current?.scrollTo({ top: 0 });
    // Marque les liens wiki sans cible connue, comme Obsidian les liens non résolus.
    contenu.current?.querySelectorAll('a[href^="wiki:"]').forEach((a) => {
      const ok = resoudreLien(decodeURIComponent(a.getAttribute("href").slice(5)), f);
      a.dataset.resolu = ok ? "oui" : "non";
    });
  }, [f]);

  return (
    <>
      <header onPointerDown={saisir} className="flex h-9 shrink-0 cursor-default select-none items-center bg-[#161616]">
        <Pastilles fermer={fermer} titre={titre} />
        <div className="ml-5 flex h-full items-end">
          <div className="flex h-7 items-center gap-2 rounded-t-md bg-[#1e1e1e] px-3 text-[12px] text-[#dcddde]">
            <FileText size={12} aria-hidden />
            {titre}
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav aria-hidden className="flex w-10 shrink-0 flex-col items-center gap-4 border-r border-white/5 bg-[#181818] pt-3 text-[#8a8a8a]">
          <Files size={16} />
          <Search size={16} />
          <Network size={16} />
        </nav>
        <aside className="hidden w-[210px] shrink-0 flex-col border-r border-white/5 bg-[#262626] md:flex">
          <p className="truncate px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a]">{racine}</p>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 text-[12.5px]">
            <Arbre noeuds={arbre} actif={f.uri} naviguer={naviguer} />
          </ul>
        </aside>
        <div ref={contenu} className="relative min-w-0 flex-1 overflow-y-auto">
          <article className="obsidian mx-auto max-w-[680px] px-8 pb-16 pt-8" onClick={surClic}>
            <h1 className="mb-4 text-[26px] font-bold text-[#f0f0f0]">{titre}</h1>
            {proprietes.length > 0 && (
              <dl className="mb-6 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-[12px]">
                {proprietes.map((p) => (
                  <div key={p.cle} className="flex gap-3 py-0.5">
                    <dt className="w-28 shrink-0 text-[#8a8a8a]">{p.cle}</dt>
                    <dd className="min-w-0 text-[#c9c9c9]">{p.valeur}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </article>
          {f.tronque && (
            <div className="pointer-events-none sticky bottom-0 flex h-40 items-end justify-center bg-gradient-to-t from-[#1e1e1e] via-[#1e1e1e]/90 to-transparent pb-6">
              <p className="flex items-center gap-2 rounded-full border border-white/10 bg-[#2a2a2a] px-4 py-1.5 text-[12px] text-[#c9c9c9]">
                <Lock size={12} aria-hidden />
                Aperçu limité dans la démo
              </p>
            </div>
          )}
        </div>
      </div>
      <footer className="flex h-6 shrink-0 items-center justify-end gap-4 border-t border-white/5 bg-[#161616] px-3 text-[11px] text-[#8a8a8a]">
        <span>{f.vedette ? "Fichier complet" : "Aperçu"}</span>
        <span>{mots.toLocaleString("fr-FR")} mots</span>
      </footer>
    </>
  );
}

/** Arborescence repliable à partir des chemins des fichiers voisins. */
function construireArbre(fichiers) {
  const racine = { enfants: new Map() };
  for (const f of fichiers) {
    const morceaux = cheminDansRacine(f).split("/");
    let n = racine;
    morceaux.forEach((m, i) => {
      const feuille = i === morceaux.length - 1;
      // Clés distinctes : « wiki.md » et le dossier « wiki/ » ne se confondent pas.
      const cle = feuille ? `f:${m}` : `d:${m}`;
      if (!n.enfants.has(cle)) n.enfants.set(cle, { nom: feuille ? m.replace(/\.md$/, "") : m, enfants: new Map(), fichier: null });
      n = n.enfants.get(cle);
      if (feuille) n.fichier = f;
    });
  }
  const trier = (n) =>
    [...n.enfants.values()]
      .map((e) => ({ ...e, enfants: trier(e) }))
      .sort((a, b) => (!!a.fichier === !!b.fichier ? a.nom.localeCompare(b.nom, "fr") : a.fichier ? 1 : -1));
  return trier(racine);
}

function Arbre({ noeuds, actif, naviguer, profondeur = 0 }) {
  return noeuds.map((n) =>
    n.fichier && !n.enfants.length ? (
      <li key={`f:${n.nom}`}>
        <button
          type="button"
          onClick={() => naviguer(n.fichier.uri)}
          style={{ paddingLeft: 8 + profondeur * 12 }}
          className={`block w-full truncate rounded py-[3px] pr-2 text-left ${
            n.fichier.uri === actif ? "bg-[#3a3a3a] text-white" : "text-[#b3b3b3] hover:bg-white/5"
          }`}
        >
          {n.nom}
        </button>
      </li>
    ) : (
      <Dossier key={`d:${n.nom}`} n={n} actif={actif} naviguer={naviguer} profondeur={profondeur} />
    ),
  );
}

/** Le sous-arbre contient-il la fiche affichée ? Comparaison exacte des URI. */
const contient = (n, uri) => n.enfants.some((e) => e.fichier?.uri === uri || contient(e, uri));

function Dossier({ n, actif, naviguer, profondeur }) {
  const contientActif = contient(n, actif);
  const [ouvert, setOuvert] = useState(contientActif || n.enfants.length < 6);
  // Une navigation vers une fiche rangée ici déplie le dossier.
  useEffect(() => {
    if (contientActif) setOuvert(true);
  }, [contientActif]);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        style={{ paddingLeft: 4 + profondeur * 12 }}
        className="flex w-full items-center gap-1 truncate rounded py-[3px] pr-2 text-left text-[#dcddde] hover:bg-white/5"
      >
        <ChevronDown size={12} aria-hidden className={`shrink-0 text-[#8a8a8a] transition-transform ${ouvert ? "" : "-rotate-90"}`} />
        {n.nom}
      </button>
      {ouvert && (
        <ul>
          <Arbre noeuds={n.enfants} actif={actif} naviguer={naviguer} profondeur={profondeur + 1} />
        </ul>
      )}
    </li>
  );
}

// ────────────────────────────────── Finder ──────────────────────────────────

const FAVORIS = [
  { nom: "Projets", Icone: Folder, actif: true },
  { nom: "Récents", Icone: Clock },
  { nom: "Bureau", Icone: Monitor },
  { nom: "Téléchargements", Icone: Download },
];

const octets = (n) =>
  n == null ? "--" : n < 1024 ? `${n} octets` : n < 1048576 ? `${Math.round(n / 1024)} Ko` : `${(n / 1048576).toFixed(1)} Mo`;
const dateFinder = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "--";
const genre = (e) => (e.dossier ? "Dossier" : /\.md$/i.test(e.nom) ? "Markdown" : /\.(jsx?|mjs|json|html|css)$/i.test(e.nom) ? "Code source" : "Document");

function Finder({ f, naviguer, ouvrirAilleurs, saisir, fermer, titre, w, reculer, avancer }) {
  const [choisi, setChoisi] = useState(null);
  const fil = f.chemin.replace(/^~\//, "").split("/");

  const activer = (e) => {
    const cible = enfant(f, e.nom);
    if (!cible) return;
    if (cible.type === "dossier") naviguer(cible.uri);
    else ouvrirAilleurs(cible.uri);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[170px] shrink-0 flex-col bg-[#ececee]/95 pt-3 text-[12.5px] backdrop-blur">
          <div onPointerDown={saisir} className="h-6 cursor-default">
            <Pastilles fermer={fermer} titre={titre} />
          </div>
          <p className="mt-3 px-4 pb-1 text-[11px] font-semibold text-[#86868b]">Favoris</p>
          <ul className="px-2">
            {FAVORIS.map(({ nom, Icone, actif }) => (
              <li
                key={nom}
                className={`flex items-center gap-2 rounded-md px-2 py-1 ${actif ? "bg-black/[0.08] font-medium" : "text-[#3a3a3c]"}`}
              >
                <Icone size={14} aria-hidden className="text-[#2f7cf6]" />
                {nom}
              </li>
            ))}
          </ul>
          <p className="mt-3 px-4 pb-1 text-[11px] font-semibold text-[#86868b]">Emplacements</p>
          <p className="flex items-center gap-2 px-4 py-1 text-[#3a3a3c]">
            <HardDrive size={14} aria-hidden className="text-[#86868b]" />
            Macintosh HD
          </p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header onPointerDown={saisir} className="flex h-[52px] shrink-0 cursor-default items-center gap-3 border-b border-black/10 px-3">
            <div className="flex gap-1 text-[#86868b]">
              <button type="button" onClick={reculer} disabled={w.position === 0} aria-label="Précédent" className="rounded p-1 enabled:hover:bg-black/5 disabled:opacity-40">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={avancer} disabled={w.position >= w.historique.length - 1} aria-label="Suivant" className="rounded p-1 enabled:hover:bg-black/5 disabled:opacity-40">
                <ChevronRight size={18} />
              </button>
            </div>
            <h2 className="truncate text-[13px] font-semibold">{titre}</h2>
            <LayoutList size={16} aria-hidden className="ml-auto text-[#86868b]" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 bg-white text-left text-[11.5px] text-[#86868b]">
                <tr className="border-b border-black/10">
                  <th className="py-1.5 pl-4 font-medium">Nom</th>
                  <th className="w-36 font-medium">Date de modification</th>
                  <th className="w-20 text-right font-medium">Taille</th>
                  <th className="w-28 pl-5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {(f.entrees ?? []).map((e, i) => {
                  const connu = !!enfant(f, e.nom);
                  const selection = choisi === e.nom;
                  return (
                    <tr
                      key={e.nom}
                      onClick={() => setChoisi(e.nom)}
                      className={selection ? "bg-[#2f7cf6] text-white" : i % 2 ? "bg-[#f5f5f7]" : ""}
                    >
                      <td className="py-[3px] pl-4">
                        <button
                          type="button"
                          onClick={() => (connu ? activer(e) : setChoisi(e.nom))}
                          onFocus={() => setChoisi(e.nom)}
                          className={`flex items-center gap-2 text-left outline-none ${connu ? "cursor-pointer" : "cursor-default"}`}
                          title={connu ? "Ouvrir" : "Non inclus dans la démo"}
                        >
                          {e.dossier ? (
                            <Folder size={15} aria-hidden className={selection ? "text-white" : "fill-[#7cb8f9] text-[#4a9bf5]"} />
                          ) : /\.(jsx?|mjs|json|html|css)$/i.test(e.nom) ? (
                            <FileCode2 size={15} aria-hidden className={selection ? "text-white" : "text-[#86868b]"} />
                          ) : (
                            <FileText size={15} aria-hidden className={selection ? "text-white" : "text-[#86868b]"} />
                          )}
                          <span className={connu && !selection ? "font-medium" : ""}>{e.nom}</span>
                        </button>
                      </td>
                      <td className={selection ? "" : "text-[#6e6e73]"}>{dateFinder(e.modif)}</td>
                      <td className={`text-right ${selection ? "" : "text-[#6e6e73]"}`}>{octets(e.taille)}</td>
                      <td className={`pl-5 ${selection ? "" : "text-[#6e6e73]"}`}>{genre(e)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="flex h-7 shrink-0 items-center gap-1 border-t border-black/10 px-3 text-[11.5px] text-[#6e6e73]">
            {fil.map((m, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={11} aria-hidden />}
                <span className="flex items-center gap-1">
                  <Folder size={11} aria-hidden className="fill-[#7cb8f9] text-[#4a9bf5]" />
                  {m}
                </span>
              </React.Fragment>
            ))}
            <span className="ml-auto">{(f.entrees ?? []).length} éléments · en gras : ouvrable dans la démo</span>
          </footer>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────── Absent ──────────────────────────────────

function Absent({ f, saisir, fermer, titre }) {
  return (
    <>
      <header onPointerDown={saisir} className="flex h-9 shrink-0 cursor-default items-center border-b border-black/10 bg-[#f6f6f6]">
        <Pastilles fermer={fermer} titre={titre} />
        <p className="flex-1 truncate pr-16 text-center text-[12.5px] font-semibold">{titre}</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <Lock size={22} aria-hidden className="text-[#86868b]" />
        <p className="text-[13.5px] font-semibold">Fichier non inclus dans la démo</p>
        <p className="text-[12px] leading-relaxed text-[#6e6e73]">
          {f?.type === "autre"
            ? "Cette page web vit dans le projet réel ; la démo ne montre que les fichiers markdown."
            : "Dans l'outil réel, ce lien ouvre le fichier dans son application."}
        </p>
      </div>
    </>
  );
}
