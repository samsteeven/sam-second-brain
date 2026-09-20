# Obsidian — le vault

## Où est le vault ?

Le vault personnel vit **localement** dans `D:\Documents\sam-second-brain-vault\` et est synchronisé sur le repo **privé** `samsteeven/sam-second-brain-vault` (jamais public). Ce dossier `obsidian/` du repo public ne contient que les **templates** et **exemples** partageables.

## Arborescence du vault

> Vue **représentative** (le vault réel contient davantage de notes dans chaque dossier).

```
sam-second-brain-vault/
├── 00-Dashboard/
│   └── Home.md              # point d'entrée, liens vers tout
├── 01-Identity/
│   ├── About-Me.md          # contexte stable : qui je suis
│   └── Academic-Profile.md  # parcours académique
├── 02-Career/
│   ├── Career-Goals.md
│   ├── Internship-Search.md # recherche de stage (6 mois)
│   ├── CV.md
│   └── LinkedIn.md
├── 03-Projects/
│   ├── TribuneJustice.md
│   ├── EasyPharma.md
│   ├── DIGITRANS-CM.md
│   ├── SIGGE.md
│   ├── Second-Brain.md
│   └── Portfolio.md
├── 04-Studies/
│   ├── M2-3iL.md
│   └── Courses.md
├── 05-Skills/
│   ├── Laravel.md
│   ├── Angular.md
│   ├── AWS.md
│   ├── Terraform.md
│   └── Cybersecurity.md
├── 06-Knowledge/
│   ├── Development/
│   ├── Cloud/
│   ├── Security/
│   ├── DevOps/
│   └── Architecture/
└── 99-Capture/              # notes ajoutées par IA (quarantaine, status: pending)
```

## Règles d'usage

1. **Une note = un sujet**. Pas de fourre-tout.
2. **Toujours le frontmatter YAML** (voir templates) : `type`, `status`, `importance`, `tags` — c'est ce qui rend le RAG filtrable.
3. **Lier les notes** avec `[[...]]` — le graphe fait la puissance d'Obsidian, et les liens améliorent le retrieval.
4. **Versionner** : le vault est un dépôt git local. Chaque note créée/modifiée → commit. (Push vers un repo **privé** si besoin.)
5. **Pour les documents lourds** (PDF, rapports) : pas dans le vault — ailleurs, avec un lien `[[...]]` ou une référence dans la note.

## Validation des notes ajoutées par une IA

Quand une IA branchée au MCP appelle `second_brain_add`, la note arrive dans **`99-Capture/`** avec **`status: pending`**. Elle n'est **jamais indexée** tant que tu ne la valides pas :

1. Ouvre la note (`99-Capture/...md`) dans Obsidian (ou GitHub).
2. Lis le contenu :
   - **Si c'est bon** → change `status: pending` en `status: active` → elle sera indexée à l'ingestion suivante.
   - **Si ce n'est pas bon** → supprime la note (ou change `status` en autre chose que `active`).
3. Committe + push (le vault se sync via git).

> C'est le garde-fou anti prompt-injection : une IA ne peut jamais polluer ta base interrogeable sans ton accord.

## Mise en place

```bash
# Le vault est déjà un dépôt git local (créé à l'init du projet)
cd D:\Documents\sam-second-brain-vault
git init
git add .
git commit -m "Initial knowledge base"
```

> Si un sync cloud est souhaité : repo GitHub **privé** uniquement (`samsteeven/sam-second-brain-vault` par exemple).