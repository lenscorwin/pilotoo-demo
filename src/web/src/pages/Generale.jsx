/**
 * Vue générale : l'état des projets, en bento.
 *
 * Depuis le 2026-10-21, les arbitrages, la vigilance et les retours d'outils
 * n'y sont plus détaillés : leur liste mettait la pression dès l'ouverture.
 * Il n'en reste que les nombres, chacun dans une tuile qui mène à la page
 * « À trancher ». Restent ici : ce qui a bougé, l'avancement d'ensemble, et
 * la grille des projets.
 */
import React from "react";
import { Scale, AlertTriangle, Hourglass, Moon, Clock, ArrowUpRight, FolderKanban } from "lucide-react";
import { Pastille, Jauge, Section, BoutonCopier } from "../components/primitives.jsx";
import { LIBELLE_STATUT, TON_STATUT, TON_ALERTE, depuis, titreMethode } from "../lib/format.js";
import { iconeProjet, TUILE_TON } from "../lib/icones.js";
import { useDepuisVisite, BarreVisite, ListeVisite } from "../components/DepuisVisite.jsx";
import { Anneau } from "../components/Progression.jsx";

export default function Generale({ etat, aller }) {
  const { projets, resume } = etat;

  // Avancement d'ensemble : toutes les cases des etat.md réunies.
  const cumul = projets.reduce(
    (acc, p) => (p.progression ? { faites: acc.faites + p.progression.faites, total: acc.total + p.progression.total } : acc),
    { faites: 0, total: 0 }
  );
  const global = cumul.total
    ? { ...cumul, pourcentage: Math.round((cumul.faites / cumul.total) * 100) }
    : null;

  // Les actifs les plus avancés, pour la tuile d'avancement.
  const enTete = projets
    .filter((p) => p.statut === "actif" && p.avancement != null)
    .sort((a, b) => b.avancement - a.avancement)
    .slice(0, 4);

  const versTrancher = (ancre) => () => aller({ vue: "a-trancher", ancre });
  const { bilan, parProjet, marquerVu } = useDepuisVisite(etat);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-8">
      <header className="mb-8">
        <p className="t-surtitre">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="t-display mt-2">Où en sont mes projets</h1>
        <p className="t-chapo mt-3 max-w-2xl">
          {resume.nbActifs} projets actifs sur {resume.nbProjets} suivis.
        </p>
      </header>

      {/* Le bento : à gauche la grande tuile nuit de l'avancement, à droite
          quatre petites tuiles de comptage. Trois mènent à « À trancher ». */}
      <div className="mb-8 grid gap-4 lg:grid-cols-12">
        <section className="bento nuit monter !bg-fond p-6 lg:col-span-5 lg:row-span-2" aria-label="Avancement">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="t-h3 text-texte">Avancement</h2>
              <p className="text-[12px] text-texte-3">toutes les étapes cochées, tous projets réunis</p>
            </div>
            {global && (
              <Anneau progression={global} taille={84} epaisseur={8}>
                <span className="tabulaire font-title text-[19px] font-semibold text-texte">{global.pourcentage}%</span>
              </Anneau>
            )}
          </div>
          <div className="mt-5 flex gap-8">
            <Chiffre valeur={resume.nbActifs} libelle="projets actifs" />
            <Chiffre valeur={resume.nbEtapesOuvertes} libelle="étapes ouvertes" />
            {global && <Chiffre valeur={global.faites} libelle="étapes faites" />}
          </div>
          {enTete.length > 0 && (
            <ul className="mt-6 space-y-3 border-t border-bord-vif/50 pt-5">
              {enTete.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => aller({ vue: "projet", id: p.id })}
                    className="group w-full text-left"
                  >
                    <span className="mb-1 block truncate text-[13px] font-bold text-texte-2 group-hover:text-texte">
                      {p.nom}
                    </span>
                    <Jauge valeur={p.avancement} ton="actif" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <TuileCompte
          className="lg:col-span-4"
          icone={Scale}
          valeur={resume.nbArbitrages}
          libelle="à trancher"
          detail={resume.nbArbitrages ? "décisions en attente" : "rien à trancher"}
          onClick={versTrancher("arbitrages")}
          lavande
        />
        <TuileCompte
          className="lg:col-span-3"
          icone={AlertTriangle}
          valeur={resume.nbVigilance}
          libelle="vigilance"
          detail={resume.nbVigilance ? "points signalés" : "rien à signaler"}
          onClick={versTrancher("vigilance")}
        />
        <TuileCompte
          className="lg:col-span-4"
          icone={Hourglass}
          valeur={resume.bilan?.attente ?? 0}
          libelle="retours d'outils"
          detail="outils attendent ton avis"
          onClick={versTrancher("retours")}
        />
        <TuileCompte
          className="lg:col-span-3"
          icone={Moon}
          valeur={resume.nbDormants}
          libelle="dormants"
          detail={resume.nbDormants ? "actifs sans activité récente" : "tous les actifs bougent"}
        />
      </div>

      <Section titre="Tous les projets" compte={projets.length} icone={FolderKanban}>
        {/* Les totaux et « Marquer comme vu » ; le détail de ce qui a bougé est dans chaque tuile. */}
        <BarreVisite bilan={bilan} marquerVu={marquerVu} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projets.map((p, i) => (
            <FicheProjet
              key={p.id}
              p={p}
              visite={parProjet[p.id]}
              suivi={!!bilan}
              delai={i * 28}
              onClick={() => aller({ vue: "projet", id: p.id })}
              versTrancher={versTrancher("arbitrages")}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Chiffre({ valeur, libelle }) {
  return (
    <div>
      <div className="tabulaire font-title text-[40px] font-semibold leading-none text-texte">{valeur}</div>
      <div className="mt-1.5 text-[12px] text-texte-3">{libelle}</div>
    </div>
  );
}

/**
 * Une tuile de comptage. Le nombre seul, sans liste : le détail est sur la
 * page « À trancher ». Neutre ou lavande, jamais rouge : un compteur qui
 * attend n'est pas une alarme.
 */
function TuileCompte({ icone: Icone, valeur, libelle, detail, onClick, lavande, className = "" }) {
  const Balise = onClick ? "button" : "div";
  return (
    <Balise
      onClick={onClick}
      className={`bento monter flex flex-col p-5 text-left ${onClick ? "bento-lien" : ""} ${
        lavande ? "clair !bg-lavande" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`grid h-11 w-11 place-items-center rounded-full ${
            lavande ? "bg-white/70 text-lavande-encre" : "bg-lavande-pale text-lavande-encre"
          }`}
        >
          <Icone size={19} strokeWidth={2} />
        </span>
        {onClick && (
          <span className={`rond-fleche ${lavande ? "bg-encre text-white" : "bg-fond text-texte"}`} aria-hidden="true">
            <ArrowUpRight size={16} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="tabulaire font-title text-[44px] font-semibold leading-none text-texte">{valeur}</span>
        <span className="text-[14px] font-bold text-texte">{libelle}</span>
      </div>
      <p className={`mt-1 text-[12.5px] ${lavande ? "text-texte-2" : "text-texte-3"}`}>{detail}</p>
    </Balise>
  );
}

function FicheProjet({ p, onClick, delai, versTrancher, visite, suivi }) {
  const ton = TON_STATUT[p.statut] ?? "termine";
  // Seul l'urgent reste en toutes lettres sur la carte. Les arbitrages ne
  // sont plus qu'un nombre, en pied de carte.
  const marquant = (p.alertes ?? []).filter((a) => a.niveau === "urgent");
  const nbArbitrages = p.arbitrages?.length ?? 0;
  const Icone = iconeProjet(p);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick(e))}
      style={{ animationDelay: `${delai}ms` }}
      className="bento bento-lien monter flex cursor-pointer flex-col p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="t-h3 flex min-w-0 items-center gap-3.5">
          {/* La tuile est le repère du projet : on la reconnaît avant de lire le nom. */}
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${TUILE_TON[ton] ?? TUILE_TON.termine}`}
            aria-hidden="true"
          >
            <Icone size={30} strokeWidth={1.7} />
          </span>
          {p.nom}
        </h3>
        {/* Le bouton loge sous la pastille, dans la hauteur de la tuile : posé
            dans le pied, il faisait passer celui-ci sur deux lignes. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Pastille ton={ton}>{LIBELLE_STATUT[p.statut] ?? p.statut}</Pastille>
          <BoutonCopier texte={p.chemin} titre={`Copier le chemin : ${p.chemin}`} />
        </div>
      </div>

      {/* Ce qu'est le projet : la synthèse rédigée par Claude (config/syntheses.json),
          sinon la description écrite à la main, sinon « Où on en est ». */}
      <p
        className="mb-4 line-clamp-3 text-[13.5px] leading-relaxed text-texte"
        title={p.synthese ? `Synthèse rédigée par Claude le ${p.synthese.redigeLe ?? "?"}` : undefined}
      >
        {p.synthese?.texte || p.description || p.ouOnEnEst || (
          <span className="text-texte-3">
            {p.instrumente ? (
              <>
                Fiche <code className="rounded bg-fond-3 px-1 py-0.5 text-[11px]">etat.md</code> présente, sans section{" "}
                <em>Où on en est</em> : c'est elle qui remplit cette place.
              </>
            ) : (
              <>
                Pas de fichier <code className="rounded bg-fond-3 px-1 py-0.5 text-[11px]">etat.md</code> : seules les
                métadonnées disque sont connues.
              </>
            )}
          </span>
        )}
      </p>

      {/* Ce qui a bougé pour ce projet. Rien à dire : une ligne discrète, pour
          que l'absence se lise aussi. Historique illisible : rien du tout. */}
      {suivi && (
        <div className="mb-4 rounded-xl bg-fond-2 px-3.5 py-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-texte-3">Depuis ta dernière visite</p>
          <ListeVisite detail={visite} complements={p.sessions ?? []} max={3} />
        </div>
      )}

      {p.avancement != null && (
        <div className="mb-4">
          <Jauge valeur={p.avancement} ton={ton} />
        </div>
      )}

      {marquant.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {marquant.map((a, i) => (
            <Pastille key={i} ton={TON_ALERTE[a.niveau]}>
              {a.texte}
            </Pastille>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 whitespace-nowrap border-t border-bord pt-3 text-[11px] text-texte-3">
        <span className="flex items-center gap-1.5">
          <Clock size={12} strokeWidth={2} />
          {depuis(p.disque?.derniereModif)}
        </span>
        {p.progression && (
          <span
            className="flex items-center gap-1.5"
            title={`${p.progression.faites} étapes cochées sur ${p.progression.total}`}
          >
            <Anneau progression={p.progression} taille={16} epaisseur={3} />
            <span className="tabulaire">
              {p.progression.faites}/{p.progression.total} étapes
            </span>
          </span>
        )}
        {nbArbitrages > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              versTrancher();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="tabulaire rounded-full bg-lavande-pale px-2 py-0.5 font-bold text-lavande-encre transition hover:bg-lavande"
            title="Voir sur la page À trancher"
          >
            {nbArbitrages} à trancher
          </button>
        )}
        <span className="ml-auto flex min-w-0 items-center gap-1.5 overflow-hidden">
          {/* « hors méthode » reste affiché, en plus discret : c'est ce qui
              signale les projets à migrer vers un starter. */}
          {p.methode && (
            <span
              className={`rounded px-1.5 py-0.5 ${
                p.methode.nom === "aucune" ? "border border-dashed border-bord text-texte-3" : "bg-fond-3"
              }`}
              title={titreMethode(p.methode)}
            >
              {p.methode.court}
            </span>
          )}
          {p.domaine && <span className="rounded bg-fond-3 px-1.5 py-0.5">{p.domaine}</span>}
        </span>
      </div>
    </div>
  );
}
