/**
 * L'heure de référence de l'interface.
 *
 * En usage normal, c'est l'heure réelle. En démo, c'est l'heure de
 * l'instantané : sans ça, la démo vieillirait toute seule (« il y a 3 jours »
 * deviendrait « il y a 1 mois », des projets passeraient en dormants) alors
 * que les données, elles, ne bougent plus. Comme une photo, la démo garde la
 * date du jour où elle a été prise.
 */

let ancre = null;

/** Fige « aujourd'hui » à une date ISO (démo). Sans argument, revient à l'heure réelle. */
export function figerAujourdhui(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  ancre = Number.isNaN(t) ? null : t;
}

/** Millisecondes de « maintenant » : l'instantané en démo, l'heure réelle sinon. */
export function maintenant() {
  return ancre ?? Date.now();
}
