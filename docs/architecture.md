# Architecture — V1

## Vue d'ensemble

```
                    TON SECOND CERVEAU
┌─────────────────────────────────────────────────────┐
│                    OBSIDIAN                         │
│  00-Dashboard/ 01-Identity/ 02-Career/ 03-Projects/ │
│  04-Studies/ 05-Skills/ 06-Knowledge/ 99-Archive/   │
└──────────────────────┬──────────────────────────────┘
                       │ Markdown + frontmatter YAML
                       ▼
                 ┌─────────────┐
                 │    GIT      │  versioning local (push vers repo privé possible)
                 └──────┬──────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                       n8n                           │
│  WORKFLOW 1 — INGESTION                             │
│  Schedule / Manual Trigger                          │
│  │  GitHub / Read Markdown files                    │
│  │  Clean & Split (chunking)                        │
│  │  Embeddings (Ollama bge-m3, local)               │
│  │  Upsert → Qdrant (avec métadonnées)              │
│                                                     │
│  WORKFLOW 2 — ASK                                  │
│  Webhook / Chat Trigger                             │
│  │  Embedding de la question                        │
│  │  Qdrant semantic search                          │
│  │  Prompt (SYSTEM + CONTEXT)                       │
│  │  LLM (OpenRouter gpt-4.1-mini) → réponse          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   QDRANT         │  Docker, port 6333 (REST) / 6334 (gRPC)
              │   collection:    │
              │   knowledge_base │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────┐
              │  OLLAMA      │  embeddings locaux (bge-m3)
              └──────────────┘
              ┌──────────────┐
              │  OPENROUTER  │  génération (chat)
              └──────────────┘
```

## Flux d'ingestion (Workflow 1)

1. **Déclencheur** : schedule toutes les 30 min.
2. **Vidage Qdrant** : la collection `knowledge_base` est vidée à chaque run (anti-doublons).
3. **Lecture des notes** : API GitHub (repo **privé** `sam-second-brain-vault`) — arbre git récursif puis contenu de chaque note `.md`.
4. **Chunking** : découpage par sections Markdown (titres `##`) avec recouvrement léger, pour que chaque chunk soit autonome.
4. **Embeddings** : **Ollama `bge-m3`** (1024 dimensions, exécuté en local sur le VPS).
5. **Upsert Qdrant** : chaque chunk est un point avec :
   ```json
   {
     "id": "tribunejustice-architecture-03",
     "vector": [0.021, -0.113, ...],
     "payload": {
       "text": "TribuneJustice utilise Laravel...",
       "file": "03-Projects/TribuneJustice.md",
       "category": "projects",
       "tags": ["laravel", "angular", "cloud"],
       "updated_at": "2026-09-19"
     }
   }
   ```
6. **Idempotence** : la collection `knowledge_base` est vidée avant chaque ré-indexation → pas de doublons.

## Flux de question (Workflow 2)

1. **Déclencheur** : Webhook (POST `{ "question": "..." }`) — extensible vers Telegram/WhatsApp.
2. **Embedding de la question**.
3. **Recherche sémantique** Qdrant : top-K = 8 chunks, avec éventuel filtre par métadonnées (`category`, `tags`).
4. **Prompt** :
   ```
   SYSTEM :
   Tu es l'assistant personnel de Sam.
   Utilise UNIQUEMENT le CONTEXT fourni pour répondre.
   Si l'information n'y est pas, dis-le honnêtement.
   Cite les fichiers sources entre crochets.
   CONTEXT : [chunks pertinents]
   QUESTION : ...
   ```
5. **Réponse** : OpenRouter `openai/gpt-4.1-mini`, température 0.2 (factuel).

## Métadonnées (frontmatter YAML dans Obsidian)

```yaml
---
type: project        # project | skill | identity | career | knowledge | meeting | idea | decision
status: active       # active | archived | draft
importance: high     # high | medium | low
tags: [laravel, angular, cloud]
---
```

Elles sont copiées dans le payload Qdrant → permet des recherches filtrées (« dans mes projets actifs uniquement »).

## Local vs cloud

| Composant | Emplacement | Raison |
|---|---|---|
| Obsidian vault | Local (`sam-second-brain-vault/`) + **repo GitHub privé** | Confidentialité + sync automatique (mobile inclus) |
| Qdrant | VPS (Docker), avec n8n | Données sous contrôle, accessible 24/7 |
| n8n | VPS | Ordonnance l'ingestion et l'interrogation |
| Ollama (embeddings) | VPS (Docker) | Modèle local, aucune donnée envoyée pour l'indexation |
| OpenRouter (génération) | Cloud | Aucun stockage : seul le contexte de la question est envoyé |

## Extensions prévues (post-V1)

- Interface Telegram / WhatsApp pour poser des questions.
- Capture automatique : article → n8n → résumé IA → note Obsidian → index.
- Réindexation différentielle (seuls les fichiers modifiés).
- Gestion des suppressions (points orphelins dans Qdrant).
- Évaluation de la qualité du retrieval.