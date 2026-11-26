/**
 * Icônes de projet.
 *
 * Une liste fermée plutôt que `import { icons } from "lucide-react"` : ce
 * dernier embarquerait les ~1 500 icônes dans le bundle pour en afficher
 * neuf. Une icône déclarée qui n'est pas ici retombe sur celle du domaine.
 */
import {
  Radar, IdCard, FileUser, GraduationCap, Library, Ship,
  BotMessageSquare, WandSparkles, Mails, Wrench, Hexagon, Briefcase,
  FileText, Code, Dices, PenLine, FolderOpen, TrainFront, Plane, Map,
  Feather, ScrollText, Castle, Sailboat, BriefcaseBusiness, UserSearch,
} from "lucide-react";

const ICONES = {
  Radar, IdCard, FileUser, GraduationCap, Library, Ship,
  BotMessageSquare, WandSparkles, Mails, Wrench, Hexagon, Briefcase,
  FileText, Code, Dices, PenLine, FolderOpen, TrainFront, Plane, Map,
  Feather, ScrollText, Castle, Sailboat, BriefcaseBusiness, UserSearch,
};

/** Repli par domaine, pour un projet découvert qui n'a rien déclaré. */
const PAR_DOMAINE = {
  outillage: Wrench,
  graphoo: Hexagon,
  emploi: Briefcase,
  admin: FileText,
  code: Code,
  jeu: Dices,
  redaction: PenLine,
};

export function iconeProjet(p) {
  return ICONES[p?.icone] ?? PAR_DOMAINE[p?.domaine] ?? FolderOpen;
}

/**
 * Teinte de la tuile d'icône selon le ton du statut (voir TON_STATUT).
 * Des classes écrites en entier : Tailwind ne compile que ce qu'il lit tel
 * quel dans le source, une classe assemblée à la volée ne sortirait jamais.
 */
export const TUILE_TON = {
  actif: "border-actif/25 bg-actif/10 text-actif",
  pause: "border-pause/25 bg-pause/10 text-pause",
  bloque: "border-bloque/25 bg-bloque/10 text-bloque",
  termine: "border-bord bg-fond-3 text-texte-3",
};
