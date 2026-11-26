/**
 * Coquille de l'application.
 *
 * Routage maison sur le fragment d'URL (`#/projet/pilotoo`) : cinq vues ne
 * justifient pas une bibliothèque de routage, et un lien partageable qui
 * survit au rechargement suffit largement ici.
 *
 * `#/` et `#/general` ouvrent la vue des projets,
 * `#/a-trancher` les arbitrages, la vigilance et les retours d'outils.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import Menu from "./components/Menu.jsx";
import Generale from "./pages/Generale.jsx";
import ATrancher from "./pages/ATrancher.jsx";
import Projet from "./pages/Projet.jsx";
import Outils from "./pages/Outils.jsx";
import { chargerEtat, relancerScan, DEMO } from "./lib/api.js";
import { BandeauDemo, AvisMobile } from "./components/Demo.jsx";
import Fenetres from "./components/Fenetres.jsx";

/**
 * `#/projet/<id>/<onglet>` : l'onglet vit dans l'URL pour qu'un rechargement,
 * ou un lien mis de côté, retombe sur le même écran.
 */
function lireRoute() {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("outils")) return { vue: "outils" };
  if (h.startsWith("general")) return { vue: "general" };
  if (h.startsWith("a-trancher")) {
    const ancre = h.split("/")[1];
    return { vue: "a-trancher", ancre };
  }
  if (h.startsWith("projet/")) {
    const [id, onglet] = h.slice(7).split("/");
    return { vue: "projet", id: decodeURIComponent(id), onglet: onglet || "suivi" };
  }
  return { vue: "general" };
}

function ecrireRoute(r) {
  const h =
    r.vue === "outils"
      ? "#/outils"
      : r.vue === "general"
        ? "#/general"
        : r.vue === "a-trancher"
          ? `#/a-trancher${r.ancre ? `/${r.ancre}` : ""}`
          : r.vue === "projet"
            ? `#/projet/${encodeURIComponent(r.id)}${r.onglet && r.onglet !== "suivi" ? `/${r.onglet}` : ""}`
            : "#/";
  if (window.location.hash !== h) window.location.hash = h;
}

export default function App() {
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [scanEnCours, setScanEnCours] = useState(false);
  const [route, setRoute] = useState(lireRoute);
  // C'est <main> qui défile, pas la fenêtre : `window.scrollTo` n'y faisait
  // rien, et la page suivante s'ouvrait au niveau de défilement de la précédente.
  const zone = useRef(null);

  useEffect(() => {
    const surHash = () => {
      const r = lireRoute();
      setRoute((avant) => {
        // Un changement de page remonte en haut, un changement d'onglet non.
        if (r.vue !== avant.vue || r.id !== avant.id) zone.current?.scrollTo({ top: 0 });
        return r;
      });
    };
    window.addEventListener("hashchange", surHash);
    return () => window.removeEventListener("hashchange", surHash);
  }, []);

  useEffect(() => {
    chargerEtat().then(setEtat).catch((e) => setErreur(e.message));
  }, []);

  const aller = useCallback((r) => {
    ecrireRoute(r);
    setRoute(r);
    zone.current?.scrollTo({ top: 0 });
  }, []);

  // Changer d'onglet ne fait pas remonter la page : on reste au même endroit.
  const allerOnglet = useCallback((onglet) => {
    setRoute((r) => {
      const suivant = { ...r, onglet };
      ecrireRoute(suivant);
      return suivant;
    });
  }, []);

  const rafraichir = useCallback(async () => {
    setScanEnCours(true);
    try {
      await relancerScan();
      setEtat(await chargerEtat());
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setScanEnCours(false);
    }
  }, []);

  const projet = route.vue === "projet" ? etat?.projets.find((p) => p.id === route.id) : null;

  // Le nom de la page dans l'onglet du navigateur : on retrouve le bon onglet
  // parmi d'autres, et l'historique se lit.
  useEffect(() => {
    const nom =
      { outils: "Outils", general: "Vue générale", "a-trancher": "À trancher" }[route.vue] ??
      (route.vue === "projet" ? projet?.nom : null);
    document.title = nom && nom !== "Pilotoo" ? `${nom} · Pilotoo` : "Pilotoo";
  }, [route.vue, projet?.nom]);

  // En démo, l'avis mobile passe avant tout : pas d'écran d'attente ou de
  // panne tassé sur un téléphone.
  if (erreur && !etat) return <>{DEMO && <AvisMobile />}<Panne message={erreur} /></>;
  if (!etat) return <>{DEMO && <AvisMobile />}<Attente /></>;


  return (
    <div className="relative flex h-full gap-3 p-3">
      {DEMO && <AvisMobile />}
      {DEMO && <BandeauDemo instantane={etat.instantane} />}
      {DEMO && <Fenetres />}
      <Menu etat={etat} route={route} aller={aller} rafraichir={rafraichir} enCours={scanEnCours} />
      <main ref={zone} className="zone-defilante relative min-w-0 flex-1 overflow-y-auto rounded-[28px]">
        {route.vue === "general" && <Generale etat={etat} aller={aller} />}
        {route.vue === "a-trancher" && <ATrancher etat={etat} aller={aller} ancre={route.ancre} />}
        {route.vue === "outils" && <Outils etat={etat} aller={aller} />}
        {route.vue === "projet" &&
          (projet ? (
            <Projet
              p={projet}
              etat={etat}
              onglet={route.onglet}
              allerOnglet={allerOnglet}
              aller={aller}
            />
          ) : (
            <Panne message="Projet introuvable : il a peut-être été renommé." />
          ))}
      </main>
    </div>
  );
}

function Attente() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-texte-3">
      <span className="animate-pulse">Lecture de l'état…</span>
    </div>
  );
}

function Panne({ message }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-bloque/30 bg-bloque/[0.07] p-6">
        <AlertCircle size={20} className="mb-3 text-bloque" strokeWidth={2} />
        <h2 className="mb-2 text-[15px] font-semibold">Pilotoo ne peut pas lire l'état</h2>
        <p className="text-[13px] leading-relaxed text-texte-2">{message}</p>
        <p className="mt-3 text-[12px] leading-relaxed text-texte-3">
          {DEMO ? (
            "L'instantané de démonstration n'a pas pu être chargé. Recharge la page dans un instant."
          ) : (
            <>
              Le serveur local est-il lancé ? <code className="rounded bg-fond-3 px-1 py-0.5">npm run dash</code> à
              la racine du projet, ou le raccourci sur le Bureau.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
