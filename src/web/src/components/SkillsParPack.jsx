/**
 * Skills d'un projet, rangés par pack, lisibles d'un coup d'œil.
 *
 * Ce qui reste visible : le nom en français et le rôle en une ligne, plus ce
 * qui compte pour décider (déjà utilisé ici ? actif ou dormant ?). Le reste
 * (comment l'appeler, ce qui le distingue, ses liens, la description d'origine)
 * se déplie à la demande. Un lien mène au skill visé : il s'ouvre et la page
 * défile jusqu'à lui, son pack se déplie s'il était replié.
 */
import React, { useMemo, useState } from "react";
import { ChevronRight, FileText, Search, Link2 } from "lucide-react";
import { Pastille, BoutonCopier } from "./primitives.jsx";
import { ouvrir } from "../lib/api.js";
import { normaliserRecherche } from "../lib/format.js";

/** Libellé de chaque type de lien, dans l'ordre où le scanner les range. */
const LIENS = {
  oriente: "Oriente vers",
  alternative: "Alternative à, un seul à la fois",
  complement: "Se combine avec",
  suite: "À enchaîner avec",
  remplace: "Remplace",
  cite: "Cités dans sa description",
};

export default function SkillsParPack({ packs, usage }) {
  const [filtre, setFiltre] = useState("");
  const [ouverts, setOuverts] = useState(() => new Set());
  // Un pack se replie par défaut au-delà de 8 skills, sauf s'il contient un
  // skill déjà utilisé : c'est celui qu'on vient chercher.
  const [packsFermes, setPacksFermes] = useState(
    () => new Set(packs.filter((g) => g.skills.length > 8 && !g.skills.some((s) => usage[s.dossier])).map((g) => g.id))
  );

  const visibles = useMemo(() => {
    const f = normaliserRecherche(filtre);
    if (!f) return packs;
    return packs
      .map((g) => ({
        ...g,
        skills: g.skills.filter((s) =>
          normaliserRecherche([s.dossier, s.lisible.nom, s.lisible.role, s.lisible.specificite].join(" ")).includes(f)
        ),
      }))
      .filter((g) => g.skills.length);
  }, [packs, filtre]);

  const basculer = (_set, setter, id, ouvrir) =>
    setter((prec) => {
      const n = new Set(prec);
      (ouvrir ?? !n.has(id)) ? n.add(id) : n.delete(id);
      return n;
    });

  /** Suivre un lien : déplier le pack et le skill visés, puis y amener la page. */
  const allerA = (dossier) => {
    const pack = packs.find((g) => g.skills.some((s) => s.dossier === dossier));
    if (!pack) return;
    setFiltre("");
    basculer(packsFermes, setPacksFermes, pack.id, false);
    basculer(ouverts, setOuverts, dossier, true);
    setTimeout(() => {
      const el = document.getElementById(`skill-${dossier}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector("summary")?.focus({ preventScroll: true });
    }, 60);
  };

  const nomDe = (dossier) =>
    packs.flatMap((g) => g.skills).find((s) => s.dossier === dossier)?.lisible.nom ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-bord bg-fond-2 px-3 py-2 focus-within:border-bord-vif">
          <Search size={14} className="text-texte-3" aria-hidden="true" />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer : vidéo, typo, audit, /hyperframes…"
            aria-label="Filtrer les skills"
            className="w-full bg-transparent text-[13px] text-texte placeholder:text-texte-3 focus:outline-none"
          />
        </label>
        <button
          onClick={() => setPacksFermes(new Set())}
          className="rounded-lg border border-bord px-3 py-2 text-[12px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
        >
          Déplier les packs
        </button>
        <button
          onClick={() => {
            setPacksFermes(new Set(packs.map((g) => g.id)));
            setOuverts(new Set());
          }}
          className="rounded-lg border border-bord px-3 py-2 text-[12px] text-texte-2 transition hover:border-bord-vif hover:text-texte"
        >
          Tout replier
        </button>
      </div>

      <div className="space-y-4">
        {visibles.map((g) => {
          const ferme = packsFermes.has(g.id) && !filtre;
          const utilises = g.skills.filter((s) => usage[s.dossier]).length;
          return (
            <section key={g.id} className="overflow-hidden rounded-xl border border-bord">
              <button
                onClick={() => basculer(packsFermes, setPacksFermes, g.id)}
                aria-expanded={!ferme}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-vert bg-vert-pale/60 px-4 py-3.5 text-left transition hover:bg-vert-pale"
              >
                <ChevronRight
                  size={15}
                  strokeWidth={2.2}
                  className={`shrink-0 text-texte-3 transition-transform ${ferme ? "" : "rotate-90"}`}
                  aria-hidden="true"
                />
                <span className="t-h3 text-[19px]">{g.nom}</span>
                <span className="tabulaire rounded-full bg-fond-3 px-2 py-0.5 text-[11px] text-texte-3">
                  {g.skills.length} skill{g.skills.length > 1 ? "s" : ""}
                </span>
                {utilises > 0 && (
                  <Pastille ton="actif">
                    {utilises} utilisé{utilises > 1 ? "s" : ""} ici
                  </Pastille>
                )}
                {g.role && <span className="min-w-0 flex-1 basis-64 text-[12.5px] text-texte-3">{g.role}</span>}
                {g.fiche && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      ouvrir(g.fiche.uri);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        ouvrir(g.fiche.uri);
                      }
                    }}
                    title="Ouvrir la fiche du pack dans la bibliothèque"
                    className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-texte-3 transition hover:bg-fond hover:text-arbitrage"
                  >
                    <FileText size={13} strokeWidth={2} /> Fiche
                  </span>
                )}
              </button>

              {!ferme && (
                <ul>
                  {g.skills.map((s) => (
                    <Skill
                      key={s.dossier}
                      s={s}
                      u={usage[s.dossier]}
                      ouvert={ouverts.has(s.dossier)}
                      basculer={() => basculer(ouverts, setOuverts, s.dossier)}
                      allerA={allerA}
                      nomDe={nomDe}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {visibles.length === 0 && <p className="text-[13px] text-texte-3">Aucun skill ne correspond à « {filtre} ».</p>}
      </div>
    </div>
  );
}

function Skill({ s, u, ouvert, basculer, allerA, nomDe }) {
  const parType = Object.keys(LIENS)
    .map((t) => ({ type: t, liens: s.liens.filter((l) => l.type === t) }))
    .filter((x) => x.liens.length);

  return (
    <li id={`skill-${s.dossier}`} className="border-t border-bord">
      <details open={ouvert} onToggle={(e) => e.currentTarget.open !== ouvert && basculer()}>
        <summary className="flex cursor-pointer list-none items-start gap-3 bg-fond px-4 py-3 transition hover:bg-fond-2 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            size={14}
            strokeWidth={2.2}
            className={`mt-[3px] shrink-0 text-texte-3 transition-transform ${ouvert ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-texte">{s.lisible.nom}</span>
            {s.lisible.role && <span className="mt-0.5 block text-[12.5px] leading-snug text-texte-2">{s.lisible.role}</span>}
          </span>
          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {u && (
              <Pastille ton="actif">
                utilisé ×{u.appels}
              </Pastille>
            )}
            {s.etat !== "dormant" && <Pastille ton="accent">Actif</Pastille>}
            <code className="hidden font-mono text-[11px] text-texte-3 sm:inline">/{s.dossier}</code>
          </span>
        </summary>

        <div className="space-y-3.5 border-t border-bord/60 bg-fond-2/60 py-3.5 pl-11 pr-4">
          <Bloc titre="Pour l'appeler">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-fond-3 px-2 py-1 font-mono text-[12px] text-texte">/{s.dossier}</code>
              <BoutonCopier texte={`/${s.dossier}`} titre={`Copier /${s.dossier}`} />
              <span className="text-[11.5px] text-texte-3">
                {s.etat === "dormant"
                  ? "Dormant : ne se déclenche que si tu tapes la commande toi-même."
                  : "Actif : Claude peut l'appeler seul quand la demande s'y prête."}
              </span>
            </div>
          </Bloc>

          <Bloc titre="Ce qui le distingue">
            {s.lisible.specificite ? (
              <p className="text-[12.5px] leading-relaxed text-texte-2">{s.lisible.specificite}</p>
            ) : (
              <p className="text-[12px] text-texte-3">
                Pas encore décrit en français : ajouter l'entrée <code>{s.dossier}</code> dans{" "}
                <code>config/skills.json</code>.
              </p>
            )}
          </Bloc>

          {u?.contexte && (
            <Bloc titre="Ce qu'il a fait ici">
              <p className="line-clamp-2 text-[12px] leading-relaxed text-texte-2">{u.contexte}</p>
            </Bloc>
          )}

          {parType.length > 0 && (
            <Bloc titre="Liens">
              <div className="space-y-1.5">
                {parType.map(({ type, liens }) => (
                  <div key={type} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-full text-[11.5px] text-texte-3 sm:w-44 sm:shrink-0">{LIENS[type]}</span>
                    {liens.map((l) => (
                      <button
                        key={l.vers}
                        onClick={() => l.installe && allerA(l.vers)}
                        disabled={!l.installe}
                        title={l.installe ? `Aller à /${l.vers}` : `/${l.vers} n'est pas installé sur ce projet`}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] transition ${
                          l.installe
                            ? "border border-bord bg-fond-3 text-texte-2 hover:border-accent/60 hover:text-texte"
                            : "cursor-default border border-dashed border-bord text-texte-3"
                        }`}
                      >
                        <Link2 size={11} strokeWidth={2} aria-hidden="true" />
                        {l.nom ?? nomDe(l.vers) ?? l.vers}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </Bloc>
          )}

          {s.descriptionComplete && (
            <Bloc titre="Description d'origine">
              <p className="text-[11.5px] leading-relaxed text-texte-3" lang="en">
                {s.descriptionComplete}
              </p>
            </Bloc>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-texte-3">
            <span className="min-w-0 break-all font-mono">{s.source}{s.dossier}/SKILL.md</span>
            {s.version && <span className="tabulaire">v{s.version}</span>}
            {s.lien && (
              <button
                onClick={() => ouvrir(s.lien.uri)}
                className="flex items-center gap-1 transition hover:text-arbitrage"
              >
                <FileText size={12} strokeWidth={2} /> Ouvrir le SKILL.md
              </button>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}

function Bloc({ titre, children }) {
  return (
    <div>
      <div className="t-label mb-1.5">{titre}</div>
      {children}
    </div>
  );
}
