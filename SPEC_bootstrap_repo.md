# SPEC.md — GitHub Project Bootstrapper

## Objectif

Module autonome permettant à l'IA de créer et initialiser un projet GitHub complet à partir d'une idée exprimée en langage naturel. L'utilisateur valide chaque étape via un workflow d'approbation. Tout est exécuté en local (pas de déploiement online).

---

## Contexte

Ce module fait partie du système "Chief AI Officer" — un multi-agent autonome qui gère le cycle de vie d'un projet, de l'idée à la rentabilité. Le présent périmètre couvre uniquement le **bootstrap d'un repo GitHub** avec génération automatique de documentation et planification de tâches.

---

## Flux principal

```
[Idée utilisateur]
       │
       ▼
[1] Création du repo GitHub (via API)
       │
       ▼
[2] Clone local du repo
       │
       ▼
[3] Génération du README.md
       │
       ▼
[4] Génération du CHANGELOG.md
       │
       ▼
[5] Génération de 5 tâches initiales (issues ou fichier TASKS.md)
       │
       ▼
[6] Commit initial + push
       │
       ▼
[Validation utilisateur à chaque étape]
```

---

## Entrées

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `idea` | string | oui | Description libre de l'idée du projet |
| `repo_name` | string | non | Nom du repo (généré automatiquement si absent) |
| `visibility` | enum | non | `public` ou `private` (défaut: `private`) |
| `github_token` | string | oui | Personal Access Token GitHub (scope: `repo`) |
| `local_path` | string | non | Répertoire parent pour le clone (défaut: `~/projects`) |

---

## Étapes détaillées

### Étape 1 — Création du repo GitHub

- Appel API `POST https://api.github.com/user/repos`
- Headers : `Authorization: Bearer {github_token}`
- Body :
  ```json
  {
    "name": "{repo_name}",
    "description": "{description_generee_par_ia}",
    "private": true,
    "auto_init": false
  }
  ```
- `auto_init: false` → on gère nous-mêmes le premier commit
- Si le repo existe déjà : skip création, passer directement au clone
- **Validation utilisateur** : afficher nom, description, visibilité → attendre confirmation

### Étape 2 — Clone local

- `git clone git@github.com:{owner}/{repo_name}.git {local_path}/{repo_name}`
- Si le repo existait déjà et est déjà cloné localement : `git pull` au lieu de `git clone`
- Vérifier que le répertoire est un repo git valide après l'opération
- **Validation utilisateur** : confirmer le chemin local

### Étape 3 — Génération du README.md

L'IA génère un README structuré à partir de l'idée. Template :

```markdown
# {Nom du projet}

{Description courte générée par l'IA}

## Objectif

{Reformulation structurée de l'idée}

## Stack technique

{Suggestion de stack basée sur l'analyse de l'idée}

## Getting Started

> Ce projet a été initialisé automatiquement par Chief AI Officer.

### Prérequis

- À définir

### Installation

```bash
git clone git@github.com:{owner}/{repo_name}.git
cd {repo_name}
```

## Roadmap

Voir [TASKS.md](./TASKS.md)

## Changelog

Voir [CHANGELOG.md](./CHANGELOG.md)

## Licence

MIT
```

- **Validation utilisateur** : afficher le README généré → attendre confirmation ou demande de modifications

### Étape 4 — Génération du CHANGELOG.md

Format [Keep a Changelog](https://keepachangelog.com/) :

```markdown
# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### Added
- Initialisation du projet à partir de l'idée : "{idea}"
- README.md généré automatiquement
- TASKS.md avec 5 tâches initiales
```

- **Validation utilisateur** : confirmation rapide (peu de raisons de modifier)

### Étape 5 — Génération de TASKS.md

L'IA analyse l'idée et produit **exactement 5 tâches** pour démarrer le projet. Chaque tâche suit ce format :

```markdown
# Tâches

## Convention

- [ ] À faire
- [x] Terminé
- [~] En cours

---

### Tâche 1 — {Titre court}

**Priorité** : {haute | moyenne | basse}
**Estimation** : {durée estimée}

{Description de ce qui doit être fait, pourquoi, et critères d'acceptance}

---

### Tâche 2 — {Titre court}
...
```

Règles de génération des tâches :
- Tâche 1 : toujours liée au **setup technique** (dépendances, structure de fichiers, config)
- Tâche 2 : toujours liée au **core feature** minimal (le cœur de l'idée)
- Tâche 3 : feature secondaire ou **intégration clé**
- Tâche 4 : **tests ou validation** (unit tests, smoke test, ou validation manuelle)
- Tâche 5 : **documentation ou polish** (compléter le README, ajouter des exemples)

- **Validation utilisateur** : afficher les 5 tâches → attendre confirmation ou modifications

### Étape 6 — Commit initial + push

```bash
cd {local_path}/{repo_name}
git add README.md CHANGELOG.md TASKS.md
git commit -m "feat: initialisation du projet — {repo_name}

Généré automatiquement par Chief AI Officer.

- README.md avec description et roadmap
- CHANGELOG.md (Keep a Changelog)
- TASKS.md avec 5 tâches initiales"
git push -u origin main
```

- **Validation utilisateur** : confirmer avant le push (dernier point de contrôle)

---

## Workflow de validation

Chaque étape suit le même pattern :

```
[IA exécute / génère]
        │
        ▼
[Affichage du résultat à l'utilisateur]
        │
        ▼
[Utilisateur choisit]
   ├── ✅ Valider → passer à l'étape suivante
   ├── ✏️ Modifier → l'IA ajuste selon le feedback, re-soumet
   └── ❌ Annuler → rollback de l'étape en cours, arrêt du flux
```

L'IA ne passe **jamais** à l'étape suivante sans validation explicite.

---

## Gestion des erreurs

| Erreur | Comportement |
|--------|-------------|
| Token GitHub invalide ou expiré | Message clair + demander un nouveau token |
| Repo existe déjà sur GitHub | Proposer : clone existant ou choix d'un autre nom |
| Repo déjà cloné localement | `git pull` au lieu de `git clone` |
| Échec du push (droits, branche protégée) | Afficher l'erreur git brute + suggestions |
| Pas de connexion réseau | Créer le repo local uniquement, reporter la création GitHub |

---

## Contraintes techniques

- **Pas de déploiement online** — tout reste en local
- **Pas de base de données** — l'état du projet vit dans le filesystem (repo git)
- **Auth GitHub** — Personal Access Token uniquement (pas d'OAuth flow)
- **Git** — doit être installé localement, l'IA utilise les commandes git CLI
- **Encoding** — tous les fichiers en UTF-8
- **Commits** — convention [Conventional Commits](https://www.conventionalcommits.org/)

---

## Arborescence générée

```
{repo_name}/
├── README.md
├── CHANGELOG.md
└── TASKS.md
```

Aucun fichier de code n'est généré à cette étape. La structure de code sera créée lors de l'exécution de la Tâche 1 du TASKS.md.

---

## Extensions futures (hors périmètre actuel)

- Création automatique de GitHub Issues à partir du TASKS.md
- Templates de projet par type (webapp, API, CLI, ML pipeline)
- Intégration avec le système multi-agent pour exécution autonome des tâches
- GitHub Actions CI/CD scaffolding
- Gestion de branches (feature branches par tâche)
- Lien avec le workspace isolé par projet du Chief AI Officer
