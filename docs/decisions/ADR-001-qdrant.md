# ADR-001 — Choisir Qdrant comme base vectorielle

- **Statut** : Accepté (2026-09-19)
- **Décideur** : Samen Steeve

## Contexte

Le second cerveau a besoin d'un index sémantique pour la recherche par similarité (RAG). Options évaluées : Qdrant (self-hosted Docker), Supabase/pgvector (managé), Chroma (léger), Weaviate.

## Décision

**Qdrant** en conteneur Docker local.

## Justification

- **Open-source et self-hosted** : les données personnelles restent sous contrôle, aucun service tiers ne stocke les embeddings.
- **Métadonnées riches** : filtrage par payload (`category`, `tags`, `status`) — nécessaire pour les recherches filtrées sur le frontmatter YAML d'Obsidian.
- **Coût nul** : tourne en local (port 6333).
- **Intégration n8n** : nœud natif Qdrant (upsert + search) dans n8n.
- **Simplicité d'exploitation** : un seul service Docker, zéro configuration de schéma.

## Conséquences

- Qdrant doit tourner pour que les workflows fonctionnent → inclus dans `docker-compose.yml`.
- La persistance est assurée par un volume Docker (`qdrant_storage`).
- Si un jour un besoin multi-utilisateur ou managé apparaît, le format des points (vector + payload) est portable vers Qdrant Cloud ou Supabase.