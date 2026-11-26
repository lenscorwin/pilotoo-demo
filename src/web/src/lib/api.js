/** Accès au serveur local. Le front ne lit jamais le disque directement. */

export async function chargerEtat() {
  const r = await fetch("/api/state");
  if (!r.ok) throw new Error(`Serveur injoignable (${r.status})`);
  return r.json();
}

/** Relance le scan. Gratuit : aucun appel de modèle côté serveur. */
export async function relancerScan() {
  const r = await fetch("/api/rescan", { method: "POST" });
  if (!r.ok) throw new Error("Le scan a échoué");
  return r.json();
}

/** Ouvre une URI dans l'application native (Obsidian, Finder). */
export async function ouvrir(uri) {
  if (!uri) return;
  await fetch("/api/ouvrir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }),
  });
}

/** Ce qui a bougé depuis une date : étapes bouclées, arbitrages tranchés, jalons. */
export async function chargerProgres(depuis) {
  const r = await fetch(`/api/progres?depuis=${encodeURIComponent(depuis)}`);
  if (!r.ok) throw new Error("Historique illisible");
  return r.json();
}
