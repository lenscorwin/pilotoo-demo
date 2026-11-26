/**
 * Fenêtre « graphe du code » de la démo : ce qui s'ouvre à la place de
 * `graph.html` quand on clique la vignette d'un projet.
 *
 * Les données viennent du vrai graphe Graphify, réduit au code (src/ et
 * scripts/) par le script de la démo, et placées comme la vignette : la grande
 * vue et la petite montrent les points au même endroit.
 *
 * On s'y déplace comme sur une carte : glisser pour se déplacer, molette ou
 * pincement pour zoomer. Un clic sur un point montre ses voisins ; la
 * recherche et la liste des familles donnent le même parcours au clavier.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2, Minimize2, Scan, Search, X, Network } from "lucide-react";

// Angle d'or, comme la vignette : des familles voisines prennent des teintes
// bien écartées. Plus clair que sur la vignette : ici le fond est sombre.
const teinte = (c) => (c < 0 ? "#8a8f98" : `oklch(0.76 0.14 ${(c * 137.508) % 360})`);
const rayon = (d) => 0.55 + Math.sqrt(d) * 0.3;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 14;
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function FenetreGraphe({ f, saisir, fermer, titre, Pastilles, agrandi, basculerAgrandi }) {
  const [g, setG] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch(`${import.meta.env.BASE_URL}${f.source}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => vivant && setG(d))
      .catch(() => vivant && setErreur(true));
    return () => {
      vivant = false;
    };
  }, [f.source]);

  return (
    <>
      <header onPointerDown={saisir} className="flex h-9 shrink-0 cursor-default select-none items-center gap-3 border-b border-white/5 bg-[#10131a]">
        <Pastilles fermer={fermer} titre={titre} agrandir={basculerAgrandi} agrandi={agrandi} />
        <p className="flex min-w-0 items-center gap-2 text-[12px] text-[#c9ced8]">
          <Network size={13} aria-hidden className="shrink-0 text-[#7fd1c7]" />
          <span className="truncate">{titre}</span>
        </p>
      </header>
      {g ? (
        <Graphe g={g} agrandi={agrandi} basculerAgrandi={basculerAgrandi} />
      ) : (
        <p className="grid flex-1 place-items-center text-[13px] text-[#8a8f98]">
          {erreur ? "Le graphe n'a pas pu être chargé." : "Chargement du graphe…"}
        </p>
      )}
    </>
  );
}

function Graphe({ g, agrandi, basculerAgrandi }) {
  const zone = useRef(null);
  const [taille, setTaille] = useState({ l: 0, h: 0 });
  const [vue, setVue] = useState(null); // { k, x, y } : échelle en px par unité, puis translation
  const [survol, setSurvol] = useState(null);
  const [choix, setChoix] = useState(null);
  const [famille, setFamille] = useState(null);
  const [requete, setRequete] = useState("");
  const vueRef = useRef(null);
  vueRef.current = vue;

  // Voisins et familles calculés une fois : tout le reste en découle.
  const { voisins, parFamille, nomFamille } = useMemo(() => {
    const v = g.noeuds.map(() => new Set());
    for (const [a, b] of g.liens) {
      v[a].add(b);
      v[b].add(a);
    }
    return {
      voisins: v,
      parFamille: new Map(g.familles.map((x) => [x.id, x])),
      nomFamille: (c) => g.familles.find((x) => x.id === c)?.nom ?? "Sans famille",
    };
  }, [g]);

  // La zone suit la taille de la fenêtre (déplacée, agrandie, redimensionnée).
  useEffect(() => {
    const el = zone.current;
    const ro = new ResizeObserver(([e]) => setTaille({ l: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cadrer = useCallback(() => {
    if (!taille.l) return null;
    const k = Math.min(taille.l / g.largeur, taille.h / g.hauteur) * 0.9;
    return { k, x: (taille.l - g.largeur * k) / 2, y: (taille.h - g.hauteur * k) / 2 };
  }, [taille, g]);
  const k0 = useMemo(() => cadrer()?.k ?? 1, [cadrer]);

  // Premier cadrage, puis recadrage quand la fenêtre change de taille.
  useEffect(() => {
    setVue(cadrer());
  }, [cadrer]);

  const animer = useRef(0);
  const allerVers = useCallback(
    (cible) => {
      cancelAnimationFrame(animer.current);
      const depart = vueRef.current;
      if (!depart || mouvementReduit()) return setVue(cible);
      const t0 = performance.now();
      const pas = (t) => {
        const p = Math.min(1, (t - t0) / 320);
        const e = 1 - Math.pow(1 - p, 3);
        setVue({ k: depart.k + (cible.k - depart.k) * e, x: depart.x + (cible.x - depart.x) * e, y: depart.y + (cible.y - depart.y) * e });
        if (p < 1) animer.current = requestAnimationFrame(pas);
      };
      animer.current = requestAnimationFrame(pas);
    },
    [],
  );
  useEffect(() => () => cancelAnimationFrame(animer.current), []);

  /** Zoom autour d'un point de l'écran (le curseur, le centre des doigts). */
  const zoomer = useCallback((facteur, px, py) => {
    setVue((v) => {
      if (!v) return v;
      const k = Math.max(k0 * ZOOM_MIN, Math.min(k0 * ZOOM_MAX, v.k * facteur));
      const r = k / v.k;
      return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
    });
  }, [k0]);

  const centrer = useCallback(
    (i, zoomMini = 2.6) => {
      const v = vueRef.current;
      if (!v) return;
      const k = Math.max(v.k, k0 * zoomMini);
      const [x, y] = g.noeuds[i];
      allerVers({ k, x: taille.l / 2 - x * k, y: taille.h / 2 - y * k });
    },
    [g, k0, taille, allerVers],
  );

  const choisir = useCallback(
    (i, recentrer = true) => {
      setChoix(i);
      setFamille(null);
      if (i != null && recentrer) centrer(i);
    },
    [centrer],
  );

  // Molette : écouteur non passif, sinon la page défile en même temps.
  useEffect(() => {
    const el = zone.current;
    const surMolette = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomer(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", surMolette, { passive: false });
    return () => el.removeEventListener("wheel", surMolette);
  }, [zoomer]);

  // Glisser pour se déplacer, deux doigts pour zoomer. Un appui sans
  // mouvement sur un point le choisit ; sur le vide, il désélectionne.
  const doigts = useRef(new Map());
  const geste = useRef(null);
  const surAppui = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const noeud = e.target.dataset?.i != null ? Number(e.target.dataset.i) : null;
    geste.current = { bouge: false, noeud, depart: { x: e.clientX, y: e.clientY } };
  };
  const surMouvement = (e) => {
    const avant = doigts.current.get(e.pointerId);
    if (!avant) return;
    const r = zone.current.getBoundingClientRect();
    if (doigts.current.size === 2) {
      const [a, b] = [...doigts.current.values()];
      const autre = a === avant ? b : a;
      const d0 = Math.hypot(avant.x - autre.x, avant.y - autre.y);
      const d1 = Math.hypot(e.clientX - autre.x, e.clientY - autre.y);
      if (d0 > 0) zoomer(d1 / d0, (e.clientX + autre.x) / 2 - r.left, (e.clientY + autre.y) / 2 - r.top);
      geste.current.bouge = true;
    } else {
      const dx = e.clientX - avant.x;
      const dy = e.clientY - avant.y;
      const g0 = geste.current;
      if (Math.hypot(e.clientX - g0.depart.x, e.clientY - g0.depart.y) > 4) g0.bouge = true;
      if (g0.bouge) setVue((v) => v && { ...v, x: v.x + dx, y: v.y + dy });
    }
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const surLacher = (e) => {
    doigts.current.delete(e.pointerId);
    const g0 = geste.current;
    if (doigts.current.size === 0 && g0 && !g0.bouge) choisir(g0.noeud, false);
    if (doigts.current.size === 0) geste.current = null;
  };

  /** Clavier sur le graphe : flèches pour se déplacer, + et − pour zoomer, 0 pour recadrer. */
  const surTouche = (e) => {
    const c = { l: taille.l / 2, h: taille.h / 2 };
    const deplacer = (dx, dy) => setVue((v) => v && { ...v, x: v.x + dx, y: v.y + dy });
    const actions = {
      ArrowLeft: () => deplacer(60, 0),
      ArrowRight: () => deplacer(-60, 0),
      ArrowUp: () => deplacer(0, 60),
      ArrowDown: () => deplacer(0, -60),
      "+": () => zoomer(1.3, c.l, c.h),
      "=": () => zoomer(1.3, c.l, c.h),
      "-": () => zoomer(1 / 1.3, c.l, c.h),
      0: () => allerVers(cadrer()),
    };
    if (e.key === "Escape" && (choix != null || famille != null)) {
      // La sélection part d'abord ; un second Échap ferme la fenêtre.
      e.stopPropagation();
      setChoix(null);
      setFamille(null);
      return;
    }
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  };

  // Ce qui reste net : le point choisi et ses voisins, ou une famille.
  const actifs = useMemo(() => {
    if (choix != null) return new Set([choix, ...voisins[choix]]);
    if (famille != null) return new Set(g.noeuds.flatMap((n, i) => (n[2] === famille ? [i] : [])));
    return null;
  }, [choix, famille, voisins, g]);

  // Les points grossissent moins vite que le zoom (en racine carrée), comme
  // une carte qui agrandit les rues sans gonfler les repères. Arrondi par
  // paliers : se déplacer ne redessine rien, zoomer seulement à chaque palier.
  const attenuation = vue ? Math.round((1 / Math.sqrt(Math.max(1, vue.k / k0))) * 20) / 20 : 1;

  // Le dessin ne dépend pas de la translation : se déplacer ne change que la
  // transformation du groupe, pas les centaines de points.
  const dessin = useMemo(
    () => (
      <>
        <g>
          {g.liens.map(([a, b], j) => {
            const net = actifs ? actifs.has(a) && actifs.has(b) && (choix == null || a === choix || b === choix || famille != null) : true;
            const couleur = choix != null && net ? teinte(g.noeuds[choix][2]) : "#9aa3b2";
            return (
              <line
                key={j}
                x1={g.noeuds[a][0]}
                y1={g.noeuds[a][1]}
                x2={g.noeuds[b][0]}
                y2={g.noeuds[b][1]}
                stroke={couleur}
                strokeOpacity={actifs ? (net ? 0.85 : 0.04) : 0.16}
                strokeWidth={choix != null && net ? 1.4 : 0.8}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        <g>
          {g.noeuds.map(([x, y, c, d], i) => (
            <circle
              key={i}
              data-i={i}
              cx={x}
              cy={y}
              r={rayon(d) * attenuation * (i === choix ? 1.5 : 1)}
              fill={teinte(c)}
              fillOpacity={actifs && !actifs.has(i) ? 0.12 : 1}
              stroke={i === choix ? "#ffffff" : "#0b0e14"}
              strokeWidth={i === choix ? 2 : 0.6}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer"
              onPointerEnter={() => setSurvol(i)}
              onPointerLeave={() => setSurvol((s) => (s === i ? null : s))}
            />
          ))}
        </g>
      </>
    ),
    [g, actifs, choix, famille, attenuation],
  );

  // Étiquettes en coordonnées d'écran, pour rester lisibles à tout zoom.
  // Plus on zoome, plus il y en a ; le point choisi, ses voisins et le point
  // survolé sont toujours nommés.
  const etiquettes = useMemo(() => {
    if (!vue || !taille.l) return [];
    const z = vue.k / k0;
    const visible = (i) => {
      const sx = g.noeuds[i][0] * vue.k + vue.x;
      const sy = g.noeuds[i][1] * vue.k + vue.y;
      return sx > -40 && sx < taille.l + 40 && sy > -20 && sy < taille.h + 20;
    };
    const ids = new Set();
    const quota = Math.min(70, Math.round(7 * z * z));
    for (let i = 0; i < g.noeuds.length && ids.size < quota; i++) {
      if (visible(i) && (!actifs || actifs.has(i))) ids.add(i);
    }
    if (choix != null) [choix, ...[...voisins[choix]].slice(0, 40)].forEach((i) => ids.add(i));
    if (survol != null) ids.add(survol);
    return [...ids].map((i) => ({
      i,
      x: g.noeuds[i][0] * vue.k + vue.x,
      y: g.noeuds[i][1] * vue.k + vue.y - rayon(g.noeuds[i][3]) * attenuation * vue.k - 4,
    }));
  }, [vue, taille, k0, g, actifs, choix, voisins, survol, attenuation]);

  const resultats = useMemo(() => {
    const q = requete.trim().toLowerCase();
    if (!q) return [];
    return g.noeuds
      .map((n, i) => ({ i, nom: n[4], fichier: n[5] }))
      .filter((n) => n.nom.toLowerCase().includes(q) || n.fichier.toLowerCase().includes(q))
      .slice(0, 8);
  }, [requete, g]);

  const n = choix != null ? g.noeuds[choix] : null;
  const listeVoisins = choix != null ? [...voisins[choix]].sort((a, b) => g.noeuds[b][3] - g.noeuds[a][3]) : [];
  const zoom = vue ? Math.round((vue.k / k0) * 100) : 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0b0e14] text-[#d7dbe3] md:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          ref={zone}
          tabIndex={0}
          role="application"
          aria-roledescription="graphe"
          aria-label={`Graphe du code de ${g.projet} : ${g.noeuds.length} éléments en ${g.familles.length} familles. Flèches pour se déplacer, plus et moins pour zoomer, zéro pour recadrer. La recherche et la liste des familles permettent de parcourir le graphe.`}
          onKeyDown={surTouche}
          onPointerDown={surAppui}
          onPointerMove={surMouvement}
          onPointerUp={surLacher}
          onPointerCancel={surLacher}
          className="absolute inset-0 cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7fd1c7] active:cursor-grabbing"
        >
          <svg width="100%" height="100%" aria-hidden className="block">
            {vue && <g transform={`translate(${vue.x} ${vue.y}) scale(${vue.k})`}>{dessin}</g>}
          </svg>
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {etiquettes.map(({ i, x, y }) => (
              <span
                key={i}
                style={{ left: x, top: y }}
                className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1 text-[11px] leading-tight ${
                  i === choix || i === survol ? "bg-[#0b0e14]/90 font-semibold text-white" : "text-[#c3c9d4] [text-shadow:0_0_3px_#0b0e14,0_0_3px_#0b0e14]"
                }`}
              >
                {g.noeuds[i][4]}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-white/10 bg-[#141823]/95 p-1">
          <Outil libelle="Dézoomer" onClick={() => zoomer(1 / 1.4, taille.l / 2, taille.h / 2)}>
            <Minus size={14} />
          </Outil>
          <span className="tabulaire w-11 text-center text-[11px] text-[#9aa3b2]" aria-live="off">
            {zoom} %
          </span>
          <Outil libelle="Zoomer" onClick={() => zoomer(1.4, taille.l / 2, taille.h / 2)}>
            <Plus size={14} />
          </Outil>
          <Outil libelle="Recadrer tout le graphe" onClick={() => allerVers(cadrer())}>
            <Scan size={14} />
          </Outil>
          <Outil libelle={agrandi ? "Réduire la fenêtre" : "Agrandir la fenêtre"} onClick={basculerAgrandi}>
            {agrandi ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Outil>
        </div>
      </div>

      <aside className="flex max-h-[42%] w-full shrink-0 flex-col border-t border-white/5 bg-[#10131a] md:max-h-none md:w-[268px] md:border-l md:border-t-0">
        <div className="relative border-b border-white/5 p-3">
          <label className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0b0e14] px-2.5 py-1.5 focus-within:border-[#7fd1c7]">
            <Search size={13} aria-hidden className="shrink-0 text-[#8a8f98]" />
            <span className="sr-only">Chercher un élément du code</span>
            <input
              type="search"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Chercher un composant, un fichier…"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[#e6e9ef] outline-none placeholder:text-[#6b7280]"
            />
          </label>
          {resultats.length > 0 && (
            <ul className="mt-2 space-y-0.5" aria-label="Résultats">
              {resultats.map((r) => (
                <li key={r.i}>
                  <button
                    type="button"
                    onClick={() => {
                      choisir(r.i);
                      setRequete("");
                    }}
                    className="w-full rounded px-2 py-1 text-left text-[12px] hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <span className="block truncate text-[#e6e9ef]">{r.nom}</span>
                    <span className="block truncate text-[11px] text-[#8a8f98]">{r.fichier}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {requete.trim() && resultats.length === 0 && <p className="mt-2 px-2 text-[12px] text-[#8a8f98]">Aucun élément ne correspond.</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="sr-only" aria-live="polite">
            {n ? `${n[4]} sélectionné, ${listeVoisins.length} voisins.` : famille != null ? `Famille ${nomFamille(famille)} mise en avant.` : ""}
          </p>
          {n ? (
            <section aria-label="Élément sélectionné">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-[14px] font-semibold text-white">{n[4]}</h3>
                  <p className="mt-0.5 break-all text-[11.5px] text-[#9aa3b2]">{n[5]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChoix(null)}
                  aria-label="Désélectionner"
                  className="grid size-6 shrink-0 place-items-center rounded text-[#9aa3b2] hover:bg-white/5 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mb-3 flex items-center gap-2 text-[12px]">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: teinte(n[2]) }} />
                {nomFamille(n[2])}
              </p>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8a8f98]">
                {listeVoisins.length} {listeVoisins.length > 1 ? "liens" : "lien"}
              </h4>
              <ul className="space-y-0.5">
                {listeVoisins.map((i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => choisir(i)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
                    >
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: teinte(g.noeuds[i][2]) }} />
                      <span className="truncate">{g.noeuds[i][4]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section aria-label="Familles">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8a8f98]">{g.familles.length} familles</h3>
              <ul className="space-y-0.5">
                {g.familles.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      aria-pressed={famille === x.id}
                      onClick={() => setFamille((c) => (c === x.id ? null : x.id))}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] focus-visible:outline-none ${
                        famille === x.id ? "bg-white/10 text-white" : "hover:bg-white/5 focus-visible:bg-white/10"
                      }`}
                    >
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: teinte(x.id) }} />
                      <span className="min-w-0 flex-1 truncate">{x.nom}</span>
                      <span className="tabulaire text-[11px] text-[#8a8f98]">{x.taille}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 px-2 text-[11.5px] leading-relaxed text-[#8a8f98]">
                Un clic sur un point montre ses liens. Glisser pour se déplacer, molette ou pincement pour zoomer.
              </p>
            </section>
          )}
        </div>
        <footer className="border-t border-white/5 px-3 py-2 text-[11px] leading-relaxed text-[#8a8f98]">
          {g.noeuds.length} éléments · {g.liens.length} liens · construit le{" "}
          {new Date(g.construit).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          <br />
          Code seul (src/, scripts/), relevé par Graphify.
        </footer>
      </aside>
    </div>
  );
}

function Outil({ libelle, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={libelle}
      title={libelle}
      className="grid size-7 place-items-center rounded-md text-[#c9ced8] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fd1c7]"
    >
      {children}
    </button>
  );
}
