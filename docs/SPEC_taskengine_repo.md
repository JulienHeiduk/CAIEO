# SPEC.md — AI Task Engine sur Repo Existant

## Objectif

Module autonome permettant à l'IA de prendre en main un repo GitHub existant (local ou distant, personnel ou tiers), d'en comprendre le contexte complet (code, spec, changelog, structure), puis de générer et exécuter des tâches intelligentes validées par l'utilisateur. Le changelog est la source de vérité vivante du projet — chaque tâche l'alimente, et chaque génération de tâches s'en nourrit.

---

## Principe fondamental

```
Le cycle est infini :

    Contexte (code + spec + changelog + historique)
                    │
                    ▼
          Génération de 5 tâches
                    │
                    ▼
           Validation utilisateur
                    │
                    ▼
          Exécution des tâches approuvées
                    │
                    ▼
          Mise à jour du changelog
                    │
                    └──────► retour au contexte enrichi
```

L'utilisateur peut relancer la génération de tâches à tout moment. L'IA s'adapte à l'état courant du projet.

---

## Flux d'initialisation

### Phase 0 — Acquisition du repo

```
[Utilisateur fournit un repo]
        │
        ├── Chemin local existant ? ──► Vérifier que c'est un repo git valide
        │
        └── URL GitHub ? ──► git clone (SSH ou HTTPS selon le contexte)
                │
                ├── Repo public : clone direct
                └── Repo privé : nécessite github_token ou clé SSH
```

**Entrées possibles :**

| Format | Exemple | Comportement |
|--------|---------|-------------|
| Chemin local | `/home/user/projects/mon-projet` | Vérification git, pas de clone |
| URL HTTPS | `https://github.com/owner/repo.git` | `git clone` HTTPS |
| URL SSH | `git@github.com:owner/repo.git` | `git clone` SSH |
| Raccourci | `owner/repo` | Résolution en URL GitHub + clone |

- Si le repo est déjà cloné au chemin cible : `git fetch && git pull` pour synchroniser
- Si le repo n'appartient pas à l'utilisateur : mode lecture seule (pas de push), l'IA travaille sur une branche locale ou un fork

### Phase 1 — Scan de contexte

L'IA construit une compréhension du projet en analysant, dans cet ordre :

```
1. Structure de fichiers (arborescence, langages, frameworks détectés)
2. SPEC.md / SPEC / spec.md (si existant)
3. README.md (si existant)
4. CHANGELOG.md (si existant)
5. TASKS.md (si existant — reprendre les tâches en cours)
6. Configuration (package.json, pyproject.toml, Cargo.toml, etc.)
7. Code source (scan des fichiers principaux, pas ligne par ligne)
8. .github/ (workflows CI/CD, issue templates)
9. Tests existants (structure, couverture apparente)
```

**Sortie du scan** — L'IA produit un résumé de contexte structuré (non écrit dans un fichier, gardé en mémoire de travail) :

```
Contexte projet :
- Nom : {repo_name}
- Stack : {langages, frameworks, outils}
- État : {vierge | early-stage | en développement | mature}
- Spec : {résumé de la spec si présente, sinon "aucune spec trouvée"}
- Changelog : {résumé des dernières entrées, sinon "aucun changelog"}
- Tâches en cours : {reprises du TASKS.md si existant}
- Points d'attention : {dettes techniques, TODOs dans le code, tests manquants}
- Propriétaire : {utilisateur | tiers (lecture seule)}
```

**Validation utilisateur** : afficher le résumé de contexte → l'utilisateur peut corriger ou compléter (ex: "le vrai objectif du projet c'est X", "ignore le dossier legacy/")

---

## Flux principal — Génération de tâches

### Déclenchement

La génération de tâches se produit :

1. **Automatiquement** après le scan initial (Phase 1)
2. **Sur demande de l'utilisateur** à tout moment ("génère de nouvelles tâches", "next tasks", "qu'est-ce qu'on fait ensuite ?")
3. **Automatiquement** après l'exécution de toutes les tâches approuvées d'un cycle

### Logique de génération

L'IA génère **exactement 5 tâches** en s'appuyant sur :

| Source de contexte | Poids | Usage |
|-------------------|-------|-------|
| CHANGELOG.md | Fort | Éviter de refaire ce qui est fait, comprendre la trajectoire |
| SPEC.md | Fort | Aligner les tâches sur l'objectif du projet |
| TASKS.md (tâches passées) | Moyen | Continuité, ne pas proposer de doublons |
| Scan du code | Moyen | Identifier les manques concrets (tests, types, config) |
| Feedback utilisateur | Fort | Prise en compte des corrections et priorités exprimées |

**Règles de génération :**

- Chaque tâche doit être **actionnable** — l'IA doit pouvoir l'exécuter concrètement (écrire du code, modifier des fichiers, créer des configs)
- Chaque tâche doit être **atomique** — un seul objectif clair, un commit isolé
- Les tâches sont **ordonnées par priorité** (la tâche 1 est la plus urgente)
- Pas de tâches vagues ("améliorer le code") — toujours un livrable précis
- Si le projet est vierge, les tâches suivent le pattern : setup → core → intégration → tests → documentation
- Si le projet est en cours, les tâches s'adaptent à l'état réel (bugs, features manquantes, refactoring nécessaire, tests à écrire)

### Format de sortie — TASKS.md

```markdown
# Tâches — Cycle {N}

> Généré le {date} à partir du contexte projet.
> Cycle précédent : {résumé 1 ligne du cycle N-1 si applicable}

## Convention

- [ ] En attente de validation
- [✅] Approuvée
- [❌] Rejetée
- [⏳] En cours d'exécution
- [✔️] Terminée

---

### Tâche 1 — {Titre court et actionnable}

**Priorité** : haute
**Estimation** : {durée}
**Fichiers concernés** : {liste des fichiers qui seront créés/modifiés}

{Description précise : quoi faire, pourquoi, critères d'acceptance}

**Statut** : [ ]

---

### Tâche 2 — ...
```

Le fichier TASKS.md est **écrasé** à chaque nouveau cycle de génération. L'historique des tâches passées est conservé dans le CHANGELOG.md.

---

## Flux de validation

```
[5 tâches générées et affichées]
            │
            ▼
[Utilisateur review chaque tâche]
   ├── ✅ Approuver (une, plusieurs, ou toutes)
   ├── ✏️ Modifier (reformuler, changer la portée)
   ├── ❌ Rejeter (avec ou sans raison)
   └── 🔄 Régénérer (demander 5 nouvelles tâches)
            │
            ▼
[Tâches approuvées passent en file d'exécution]
```

**Règles :**
- L'utilisateur peut approuver un sous-ensemble (ex: tâches 1, 3, 5 uniquement)
- Les tâches rejetées avec feedback alimentent le contexte pour la prochaine génération
- L'utilisateur peut modifier une tâche avant de l'approuver — la version modifiée fait foi
- L'utilisateur peut demander une régénération complète à tout moment

---

## Flux d'exécution

### Exécution d'une tâche

```
[Tâche approuvée]
        │
        ▼
[IA exécute : écriture de code, modifications, configs]
        │
        ▼
[Résultat affiché à l'utilisateur]
        │
        ├── ✅ Valider → commit + mise à jour changelog
        ├── ✏️ Demander des ajustements → l'IA corrige, re-soumet
        └── ❌ Annuler → git checkout pour rollback les modifications
```

### Commit

Chaque tâche terminée produit **un seul commit** :

```
{type}: {description courte}

Tâche {N} du cycle {C}.
{description détaillée de ce qui a été fait}

Fichiers modifiés :
- {liste}
```

Convention Conventional Commits :
- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `refactor:` restructuration sans changement fonctionnel
- `test:` ajout ou modification de tests
- `docs:` documentation
- `chore:` maintenance, config, dépendances

### Push

- Si le repo appartient à l'utilisateur : push possible (après validation)
- Si le repo est tiers : pas de push, les commits restent locaux
- L'utilisateur décide quand push (pas de push automatique)

---

## Mise à jour du CHANGELOG.md

Après chaque tâche exécutée et validée, le CHANGELOG.md est mis à jour :

```markdown
## [Unreleased]

### Added
- {si la tâche ajoute quelque chose}

### Changed
- {si la tâche modifie quelque chose}

### Fixed
- {si la tâche corrige quelque chose}

### Removed
- {si la tâche supprime quelque chose}
```

**Règles :**
- Format [Keep a Changelog](https://keepachangelog.com/)
- Chaque entrée est une ligne concise et compréhensible par un humain
- Le CHANGELOG est committé dans le même commit que la tâche
- Si le CHANGELOG n'existait pas, il est créé au premier cycle

---

## Boucle de contexte

C'est le mécanisme central. À chaque génération de tâches, l'IA reconstruit son contexte :

```
┌─────────────────────────────────────────┐
│            Contexte enrichi             │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │  SPEC   │  │CHANGELOG │  │  CODE  │ │
│  │ (fixe)  │  │(grandit) │  │(évolue)│ │
│  └────┬────┘  └────┬─────┘  └───┬────┘ │
│       │            │             │      │
│       └────────────┼─────────────┘      │
│                    │                    │
│                    ▼                    │
│         Génération intelligente         │
│          de 5 nouvelles tâches          │
│                                         │
│  Le CHANGELOG empêche les doublons      │
│  La SPEC maintient le cap               │
│  Le CODE révèle les vrais besoins       │
│                                         │
└─────────────────────────────────────────┘
```

Le CHANGELOG est donc à la fois une **sortie** (alimenté par les tâches) et une **entrée** (lu pour générer les tâches suivantes). C'est la mémoire du projet.

---

## Commandes utilisateur

L'utilisateur peut à tout moment déclencher ces actions :

| Commande | Action |
|----------|--------|
| `scan` | Re-scanner le repo (après modifications manuelles) |
| `generate` / `next` | Générer un nouveau cycle de 5 tâches |
| `approve {1,3,5}` | Approuver des tâches par numéro |
| `approve all` | Approuver toutes les tâches |
| `reject {2} "raison"` | Rejeter une tâche avec feedback |
| `edit {4} "nouveau scope"` | Modifier une tâche avant approbation |
| `run` | Exécuter les tâches approuvées dans l'ordre |
| `run {3}` | Exécuter une tâche spécifique |
| `status` | Afficher l'état courant (tâches, cycle, derniers commits) |
| `changelog` | Afficher le changelog |
| `push` | Push les commits locaux vers le remote |
| `rollback` | Annuler la dernière tâche exécutée |

Ces commandes sont des raccourcis. L'utilisateur peut aussi s'exprimer en langage naturel — l'IA interprète l'intention.

---

## Gestion des erreurs

| Situation | Comportement |
|-----------|-------------|
| Repo introuvable (URL ou chemin) | Message clair + demander correction |
| Repo privé sans accès | Demander token ou clé SSH |
| Pas de SPEC ni de README | L'IA travaille uniquement à partir du code et demande du contexte à l'utilisateur |
| CHANGELOG corrompu ou non-standard | L'IA le lit au mieux, propose de le reformater en Keep a Changelog |
| Conflit git pendant l'exécution | Afficher le conflit, demander résolution à l'utilisateur |
| Tâche impossible à exécuter (dépendance manquante, API externe) | Marquer la tâche comme bloquée, expliquer pourquoi, proposer une alternative |
| Code trop volumineux pour le scan | Scan ciblé (entry points, configs, tests) + demander à l'utilisateur les zones prioritaires |

---

## Contraintes techniques

- **Tout est local** — pas de déploiement, pas de serveur
- **Git CLI** — toutes les opérations git passent par les commandes CLI
- **Pas de base de données** — le filesystem (repo git) est la seule source de vérité
- **CHANGELOG.md** = mémoire persistante du projet
- **TASKS.md** = état courant du cycle (écrasé à chaque génération)
- **Encoding** — UTF-8 partout
- **Commits** — Conventional Commits
- **Pas de modification du remote sans validation** — jamais de push automatique

---

## Arborescence gérée par le module

```
{repo}/
├── ... (code existant, non touché sauf par les tâches)
├── SPEC.md          ← lu si existant, jamais modifié par l'IA
├── README.md        ← lu si existant, modifiable par une tâche
├── CHANGELOG.md     ← lu + alimenté à chaque tâche terminée
└── TASKS.md         ← généré/écrasé à chaque cycle de tâches
```

---

## Extensions futures (hors périmètre actuel)

- Création de branches par tâche (`task/{cycle}-{numéro}`)
- Création automatique de GitHub Issues à partir des tâches
- Mode multi-agent (un agent par tâche en parallèle)
- Intégration avec le workspace isolé du Chief AI Officer
- Détection de régressions (lancer les tests avant/après chaque tâche)
- Résumé de PR automatique après un cycle complet
- Support de monorepos (scan ciblé par package)
