# ADR-006 — Validation humaine des écritures IA (quarantaine)

- **Statut** : Accepté (2026-09-19)
- **Décideur** : Samen Steeve

## Contexte

L'outil MCP `second_brain_add` donne à une IA branchée la capacité d'**écrire** dans le vault. Risques identifiés :
- **Prompt injection** : une note malveillante lue par une IA pourrait l'inciter à écrire du contenu nocif.
- **Hors contexte** : contenu non pertinent, erreurs, pollution de la base interrogeable.
- **Pas de contrôle humain** sur ce qui entre dans la base.

## Décision

Mettre en place un **sas de validation humaine** par statut :

1. `second_brain_add` écrit la note dans le vault privé, dans son **dossier classé automatiquement** (ex. `06-Knowledge/…`), avec **`status: pending`** (frontmatter).
2. **L'ingestion ignore les notes `pending`** → jamais indexées, jamais interrogeables par `second_brain_ask`.
3. **L'utilisateur valide** : dans Obsidian ou GitHub, il relit la note puis soit la **supprime**, soit passe `status: active`.
4. À l'ingestion suivante, la note validée est indexée.

## Justification

- **Aucune infrastructure supplémentaire** : le statut est un champ du frontmatter déjà parsé par l'ingestion.
- **Containment** : le pire qu'une IA compromise puisse faire est d'écrire une note en **quarantaine, invisible et réversible** (tout est versionné Git).
- **Simplicité** : la validation se fait dans Obsidian (l'outil de l'utilisateur) sans nouvelle interface.

## Conséquences

- Les notes ajoutées par IA restent sur le repo privé (traçables) mais n'entrent dans le RAG qu'après validation.
- L'ingestion filtre sur `status === 'pending'` (dans le nœud « Décoder + métadonnées »).
- Alternative future si besoin : un canal d'approbation HITL (Slack/Telegram) au lieu de la validation manuelle dans Obsidian.