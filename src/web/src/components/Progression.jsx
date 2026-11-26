/**
 * Progression des étapes, en lecture seule.
 *
 * Le dashboard ne coche rien : une étape passe en « Fait » parce qu'elle a été
 * cochée dans le etat.md du projet. Ce qui est rejoué ici, c'est le moment de
 * la clôture : les étapes cochées depuis la dernière visite de la page se
 * cochent sous les yeux à l'ouverture, l'anneau part de l'ancienne valeur, et
 * un palier franchi entre-temps déclenche son éclat.
 *
 * La mémoire de « déjà vu » est gardée dans le navigateur, par projet : c'est
 * une commodité de lecture, pas une donnée du projet.
 */
import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export const PALIERS = [25, 50, 75, 100];
const DELAI_DEPART = 450;
const DUREE_SORTIE = 1100;

const pourcent = (faites, total) => (total ? Math.round((100 * faites) / total) : 0);
const palierFranchi = (avant, apres) => PALIERS.filter((x) => avant < x && apres >= x).at(-1) ?? null;

function lireVues(id) {
  try {
    const brut = localStorage.getItem(`pilotoo.etapesVues.${id}`);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

function ecrireVues(id, textes) {
  try {
    localStorage.setItem(`pilotoo.etapesVues.${id}`, JSON.stringify(textes));
  } catch {
    // Stockage refusé : l'animation se rejouera à la prochaine visite, sans gravité.
  }
}

/**
 * Les étapes du projet, plus celles qui ont été cochées depuis la dernière
 * visite (`nouvelles`). Première visite d'un projet : rien n'est rejoué, on
 * retient seulement ce qui est déjà coché.
 */
export function useProgression(p) {
  const ouvertes = p.etapes ?? [];
  const closes = p.etapesCloses ?? [];
  const progression = p.progression ?? null;

  const [nouvelles, setNouvelles] = useState([]);
  const [rejoue, setRejoue] = useState(false);
  const [eclat, setEclat] = useState(null);

  useEffect(() => {
    const textes = closes.map((e) => e.texte);
    const vues = lireVues(p.id);
    ecrireVues(p.id, textes);
    setEclat(null);
    if (!vues) return setNouvelles([]);

    const dejaVues = new Set(vues);
    const neuves = closes.filter((e) => !dejaVues.has(e.texte));
    setNouvelles(neuves);
    setRejoue(false);
    if (!neuves.length || !progression) return;

    const minuteur = setTimeout(() => {
      setRejoue(true);
      const avant = pourcent(progression.faites - neuves.length, progression.total);
      const palier = palierFranchi(avant, progression.pourcentage);
      if (palier) setEclat({ palier, cle: Date.now() });
    }, DELAI_DEPART);
    return () => clearTimeout(minuteur);
  }, [p]);

  // Tant que le rejeu n'a pas démarré, l'anneau montre l'ancienne valeur.
  const affichee =
    progression && nouvelles.length && !rejoue
      ? { ...progression, faites: progression.faites - nouvelles.length, pourcentage: pourcent(progression.faites - nouvelles.length, progression.total) }
      : progression;

  return { ouvertes, closes, nouvelles, rejoue, progression: affichee, eclat };
}

/**
 * Anneau de progression, crans à 25, 50 et 75 %. Le compte est écrit au
 * centre : l'anneau ne dit jamais rien que le texte ne dise aussi.
 */
export function Anneau({ progression, taille = 72, epaisseur = 6, eclat, children }) {
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const pc = progression?.pourcentage ?? 0;
  const fini = pc >= 100;

  return (
    <div className="relative shrink-0" style={{ width: taille, height: taille }}>
      <svg
        width={taille}
        height={taille}
        viewBox={`0 0 ${taille} ${taille}`}
        className="-rotate-90"
        role="img"
        aria-label={
          progression ? `${progression.faites} étapes cochées sur ${progression.total}, ${pc} %` : "Aucune étape"
        }
      >
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--color-fond-3)" strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          fill="none"
          stroke={fini ? "var(--color-accent)" : "var(--color-actif)"}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pc / 100)}
          className="anneau-trait"
        />
        {/* Les crans des paliers, coupés dans l'épaisseur de l'anneau. Sous
            40 px ils ne se lisent plus et trouent le trait : on les retire. */}
        {taille >= 40 && PALIERS.slice(0, 3).map((x) => {
          const a = (x / 100) * 2 * Math.PI;
          const x1 = taille / 2 + (r - epaisseur / 2) * Math.cos(a);
          const y1 = taille / 2 + (r - epaisseur / 2) * Math.sin(a);
          const x2 = taille / 2 + (r + epaisseur / 2) * Math.cos(a);
          const y2 = taille / 2 + (r + epaisseur / 2) * Math.sin(a);
          return <line key={x} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-fond)" strokeWidth="2" />;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
      {eclat && <Eclat key={eclat.cle} />}
    </div>
  );
}

/**
 * L'éclat d'un palier franchi : douze traits qui partent de l'anneau et
 * s'éteignent. Purement décoratif, masqué aux lecteurs d'écran et coupé par
 * `prefers-reduced-motion`.
 */
function Eclat() {
  return (
    <div className="eclat pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} style={{ "--angle": `${i * 30}deg`, "--delai": `${(i % 3) * 40}ms` }} />
      ))}
    </div>
  );
}

/** En-tête de page projet : l'anneau des étapes, puis le libellé du palier. */
export function BlocProgression({ progression, eclat }) {
  if (!progression) return null;
  const pc = progression.pourcentage;
  const prochain = PALIERS.find((x) => x > pc);
  return (
    <div className="flex items-center gap-4">
      <Anneau progression={progression} eclat={eclat}>
        <span className="tabulaire text-[15px] font-semibold leading-none">
          {progression.faites}
          <span className="text-[11px] font-normal text-texte-3">/{progression.total}</span>
        </span>
      </Anneau>
      <div className="text-[12px] leading-relaxed">
        <div className="font-semibold text-texte">
          <span className="tabulaire">{pc}</span> % des étapes cochées
        </div>
        <div className="text-texte-3">
          {pc >= 100 ? "Toutes les étapes sont bouclées." : `Prochain palier : ${prochain} %`}
        </div>
        {eclat && (
          <div key={eclat.cle} className="palier-annonce mt-0.5 font-semibold text-accent" role="status">
            Palier {eclat.palier} % franchi
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * La check-list des étapes. Les cases ne sont pas des boutons : elles disent
 * ce qui est coché dans etat.md. Une étape cochée depuis la dernière visite
 * apparaît d'abord parmi les ouvertes, se coche, se barre, puis rejoint
 * « Fait » : c'est ce délai qui rend la clôture visible.
 */
export function ChecklistEtapes({ ouvertes, closes, nouvelles, rejoue }) {
  const [sorties, setSorties] = useState(false);
  const minuteur = useRef(null);

  useEffect(() => {
    setSorties(false);
    if (!rejoue || !nouvelles.length) return;
    minuteur.current = setTimeout(() => setSorties(true), DUREE_SORTIE);
    return () => clearTimeout(minuteur.current);
  }, [rejoue, nouvelles]);

  const enRejeu = sorties ? [] : nouvelles;
  const cles = new Set(enRejeu.map((e) => e.texte));
  const affichees = [...ouvertes, ...enRejeu];
  const faites = closes.filter((e) => !cles.has(e.texte));

  return (
    <div>
      {affichees.length === 0 ? (
        <p className="flex items-center gap-3 text-sm text-texte-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-actif" />
          Aucune étape en attente.
        </p>
      ) : (
        <ul className="space-y-1">
          {affichees.map((e, i) => {
            const neuve = cles.has(e.texte);
            const cochee = neuve && rejoue;
            return (
              <li
                key={`${e.texte}-${i}`}
                className={`flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm leading-relaxed text-texte-2 ${
                  cochee ? "etape-sortante" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border-[1.5px] ${
                    cochee ? "case-cochee border-actif bg-actif text-fond" : "border-bord-vif text-transparent"
                  }`}
                >
                  <Check size={12} strokeWidth={3.2} />
                </span>
                <span className={`etape-texte min-w-0 ${cochee ? "text-texte-3" : ""}`}>
                  {e.texte}
                  {neuve && <span className="sr-only">, cochée depuis ta dernière visite</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {faites.length > 0 && <ListeFaites closes={faites} />}

      <p className="mt-3 px-2 text-[11px] text-texte-3">
        Les cases se cochent dans le etat.md du projet. Le dashboard ne fait que les lire.
      </p>
    </div>
  );
}

/** Les étapes cochées, repliées. */
function ListeFaites({ closes }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="mt-3 border-t border-bord pt-2">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-texte-3 transition hover:bg-fond-2 hover:text-texte-2"
      >
        <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform ${ouvert ? "rotate-180" : ""}`} />
        Fait <span className="tabulaire">({closes.length})</span>
      </button>
      {ouvert && (
        <ul className="mt-1 space-y-0.5">
          {closes.map((e, i) => (
            <li key={`${e.texte}-${i}`} className="flex items-start gap-3 px-2 py-1 text-[13px] leading-relaxed text-texte-3">
              <span className="mt-[3px] grid h-[16px] w-[16px] shrink-0 place-items-center rounded-md bg-actif/25 text-actif">
                <Check size={11} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 line-through decoration-texte-3/50">{e.texte}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
