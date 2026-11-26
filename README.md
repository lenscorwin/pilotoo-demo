# Pilotoo

**Le tableau de bord de mes projets.** Une page qui dit où en est chacun, ce qui attend une décision et quels outils servent vraiment.

> Ce dépôt est la version publique et figée de Pilotoo. L'outil réel lit mon disque ; la démo lit un instantané du 25/11/2026, nettoyé et complété. **Données de démonstration, méthode et outil réels.**

## Le problème

Je mène une dizaine de projets en parallèle, design, code et outillage IA. Je ne savais plus où en était chacun, ni quels outils j'avais installés, testés ou abandonnés. Les notes étaient là, éparpillées dans chaque dossier, mais aucune vue d'ensemble.

## Les principes

1. **Une seule source de vérité.** L'état d'un projet vit dans son propre fichier `etat.md`, écrit à la main ou dans Obsidian. Pilotoo ne fait que le lire.
2. **Le déclaré face au constaté.** Ce que j'écris (résumé, étapes, décisions) est comparé à ce que le scanner relève (dates de modification, état git, outils installés). Quand les deux divergent, le dashboard le signale au lieu de choisir.
3. **Rien ne s'écrit à ma place.** Le dashboard est en lecture seule. Les cases cochées reflètent le fichier, elles ne sont pas cliquables.
4. **Zéro coût caché.** Le scan ne lit que des métadonnées et du markdown, sans appel à un modèle d'IA. Il peut tourner aussi souvent que voulu.

## Ce qu'on y voit

- **Vue générale** : chaque projet en une tuile, avec sa synthèse, son avancement et ce qui a changé depuis la dernière visite.
- **À trancher** : toutes les décisions en attente, tous projets confondus.
- **Page projet** : suivi, graphe git, copies de travail en cours, outils branchés, essais menés, usage réel des outils.
- **Outils** : le catalogue transverse, croisé avec les fiches, les projets et les retours d'essai.

## Comment je travaille

Pilotoo est l'outil, mais ce dépôt montre aussi ma façon de faire :

- **Une branche par tâche** (Agentastic) : plusieurs agents travaillent en parallèle, chacun dans sa copie, sans se marcher dessus.
- **Une mémoire écrite** (Obsidian) : une page par sujet, un fichier d'état par projet, un journal, et un rituel de clôture à chaque fin de session.
- **Une carte du code** (Graphify) : sur les gros projets, un graphe calculé localement remplace la relecture de tout le code.
- **Un cadrage par interview** : avant de construire, une question à la fois, avec une réponse recommandée.

### À propos des pull requests

Je n'avais pas encore travaillé en équipe avec des pull requests. Alors j'ai appliqué ce rituel à mon propre projet : une branche et une PR par fonction, une description (le problème, ce qui change, comment vérifier), une vérification automatique à chaque PR et une relecture avant chaque fusion. La relecture est faite par Claude, et chaque PR le dit.

## Feuille de route v1.0

- [x] Socle : le code de l'outil réel, configuration d'exemple
- [x] Vérification automatique à chaque PR
- [x] Contrôle de sensibilité sur tout le dépôt, à chaque PR
- [ ] Mode démo : l'interface lit un instantané au lieu du serveur
- [ ] Données de démonstration nettoyées
- [ ] Fenêtres Finder et Obsidian simulées pour ouvrir les fichiers
- [ ] Accueil en visite guidée
- [ ] Graphe du code : le code de l'outil et de graphoo.fr vu par Graphify, à parcourir en grand

## Stack

Vite, React, Tailwind CSS v4 et Lucide au front. Node et Express pour le scanner et le serveur local. Aucune base de données, aucun service en ligne.

## Lancer l'outil réel

```bash
npm install
npm run dash    # scan, build et serveur sur http://127.0.0.1:3737
```

Adapter d'abord les chemins de `config/targets.json` à sa machine. Un projet est suivi dès qu'il a un `wiki/etat.md` ou un `ETAT.md`.

| Commande | Ce qu'elle fait |
|---|---|
| `npm run scan` | relit les projets et écrit `data/state.json` |
| `npm run serve` | sert le dashboard en local, en lecture seule |
| `npm run dev` | serveur et rechargement à chaud |
| `npm run build` | compile l'interface |
| `npm run controle:sensibilite` | relit tout le dépôt à la recherche d'une donnée sensible |

## Le contrôle de sensibilité

Un second contrôle tourne ici, à chaque PR et à chaque compilation de la démo : `scripts/controle-sensibilite.mjs` relit tous les fichiers du dépôt, et la démo compilée quand elle existe. Il fait échouer la vérification s'il trouve un chemin de dossier personnel, une adresse e-mail, une forme de clé d'accès, un tiret long ou un mot privé.

Les mots privés n'y figurent pas en clair : le dépôt n'en garde que les empreintes (`scripts/empreintes-sensibles.json`), et le contrôle compare l'empreinte de chaque mot lu. Son journal masque ce qu'il trouve, car les journaux de vérification d'un dépôt public sont publics eux aussi.

## Structure

```
config/        projets suivis, seuils, dictionnaire des skills
scripts/       contrôle de sensibilité
src/scanner/   lecture des projets, de git et du catalogue d'outils
src/server/    serveur local, lecture seule
src/web/       interface Vite + React + Tailwind
```

## Licence

MIT. Conçu par Loïs Pearron, [graphoo.fr](https://graphoo.fr).
