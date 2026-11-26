/**
 * Résolution des URI `obsidian://`.
 *
 * Obsidian tient la liste de ses vaults dans un JSON de préférences. On s'en
 * sert pour savoir si un projet est déjà ouvert comme vault : si oui, le
 * dashboard peut pointer directement sur une note, sinon on se rabat sur un
 * lien `file://` qui ouvre le Finder.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PREFS = path.join(
  os.homedir(),
  "Library/Application Support/obsidian/obsidian.json"
);

/** Vaults connus d'Obsidian, du chemin le plus long au plus court. */
export function chargerVaults() {
  try {
    const brut = JSON.parse(fs.readFileSync(PREFS, "utf8"));
    return Object.values(brut.vaults ?? {})
      .filter((v) => v?.path)
      .map((v) => ({ chemin: v.path, nom: path.basename(v.path), ouvert: !!v.open }))
      .sort((a, b) => b.chemin.length - a.chemin.length);
  } catch {
    return [];
  }
}

/** Le vault le plus spécifique qui contient ce chemin, ou null. */
export function vaultDe(cheminProjet, vaults) {
  const cible = path.resolve(cheminProjet);
  return (
    vaults.find((v) => {
      const racine = path.resolve(v.chemin);
      return cible === racine || cible.startsWith(racine + path.sep);
    }) ?? null
  );
}

/**
 * URI d'ouverture d'un fichier. `obsidian://` si le fichier est dans un vault
 * connu, `file://` sinon : dans les deux cas le clic ouvre quelque chose.
 */
export function uriOuverture(cheminAbsolu, vaults) {
  const vault = vaultDe(cheminAbsolu, vaults);
  const estMarkdown = cheminAbsolu.toLowerCase().endsWith(".md");

  if (vault && estMarkdown) {
    const relatif = path
      .relative(path.resolve(vault.chemin), path.resolve(cheminAbsolu))
      .split(path.sep)
      .join("/");
    return {
      type: "obsidian",
      uri: `obsidian://open?vault=${encodeURIComponent(vault.nom)}&file=${encodeURIComponent(
        relatif.replace(/\.md$/i, "")
      )}`,
      vault: vault.nom,
    };
  }
  return { type: "fichier", uri: `file://${encodeURI(cheminAbsolu)}`, vault: vault?.nom ?? null };
}
