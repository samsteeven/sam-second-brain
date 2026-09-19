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
                 │    GIT      │  repo privé sam-second-brain-vault
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
│  WORKFLOW 2 — ASK / MCP                              │
│  Webhook / MCP Server Trigger                        │
│  │  Embedding de la question (Ollama bge-m3)         │
│  │  Qdrant semantic search                           │
│  │  Prompt (SYSTEM + CONTEXT)                        │
│  │  LLM (OpenCode Go deepseek-v4-flash-vision-exp)   │
│                                                     │
│  WORKFLOW 3 — MCP DÉDIÉ                              │
│  second_brain_ask  → KB Query (RAG)                  │
│  second_brain_add  → Add Note (écriture quarantaine) │
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
              │  OPENCODE GO │  génération (chat) — /zen/go/v1 + x-opencode-session
              └──────────────┘
```

**Une IA (ChatGPT, Claude, Cursor, opencode…) se branche via MCP** sur le serveur dédié (`/mcp/second-brain-kb`, bearer auth) et découvre 2 outils :
- `second_brain_ask` — lire (RAG complet avec sources) ;
- `second_brain_add` — écrire une note en **quarantaine** (`status: pending`), validée par l'utilisateur avant indexation.

**Obsidian = mémoire externe structurée. n8n = moteur d'ingestion + serveur MCP. Qdrant = index sémantique. Ollama = embeddings locaux. OpenCode Go = génération. L'utilisateur valide chaque écriture IA.**

## Flux d'ingestion (Workflow 1)

1. **Déclencheur** : schedule toutes les 30 min.
2. **Vidage Qdrant** : la collection `knowledge_base` est vidée à chaque run (anti-doublons).
3. **Lecture des notes** : API GitHub (repo **privé** `sam-second-brain-vault`) — arbre git récursif puis contenu de chaque note `.md` (un appel par note, sans boucle).
4. **Filtre quarantaine** : les notes `status: pending` (écrites par IA, non validées) sont **exclues**.
5. **Chunking** : découpage par sections Markdown (titres `##`) avec recouvrement léger, pour que chaque chunk soit autonome.
6. **Embeddings** : **Ollama `bge-m3`** (1024 dimensions, exécuté en local sur le VPS).
7. **Upsert Qdrant** : chaque chunk est un point avec :
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
5. **Réponse** : OpenCode Go `deepseek-v4-flash-vision-exp` (`https://opencode.ai/zen/go/v1` + header `x-opencode-session`), température 0.2 (factuel).

## Flux MCP (Workflow 3) — lecture + écriture

- `second_brain_ask` : comme le flux de question, mais exposé comme **outil MCP** (via MCP Server Trigger + Custom Workflow Tool). L'IA appelle l'outil avec une question → réponse + sources.
- `second_brain_add` : écrit une note markdown dans `99-Capture/` du vault privé avec **`status: pending`** → **quarantaine** (non indexée). L'utilisateur valide (passe à `active`) ou supprime. Voir ADR-006.

## Métadonnées (frontmatter YAML dans Obsidian)

```yaml
---
type: project        # project | skill | identity | career | knowledge | meeting | idea | decision | note
status: active       # active | archived | draft | pending (quarantaine IA)
importance: high     # high | medium | low
tags: [laravel, angular, cloud]
---
```

Elles sont copiées dans le payload Qdrant → permet des recherches filtrées (« dans mes projets actifs uniquement »). Le statut **`pending`** est exclu de l'indexation (écritures IA en attente de validation).

## Local vs cloud

| Composant | Emplacement | Raison |
|---|---|---|
| Obsidian vault | Local (`sam-second-brain-vault/`) + **repo GitHub privé** | Confidentialité + sync automatique (mobile inclus) |
| Qdrant | VPS (Docker), avec n8n | Données sous contrôle, accessible 24/7 |
| n8n | VPS | Ordonnance l'ingestion et l'interrogation |
| Ollama (embeddings) | VPS (Docker) | Modèle local, aucune donnée envoyée pour l'indexation |
| OpenCode Go (génération) | Cloud | Aucun stockage : seul le contexte de la question part vers la passerelle |

## Extensions prévues (post-V1)

- Interface Telegram / WhatsApp pour poser des questions.
- Capture automatique : article → n8n → résumé IA → note Obsidian → index.
- Réindexation différentielle (seuls les fichiers modifiés).
- Gestion des suppressions (points orphelins dans Qdrant).
- Évaluation de la qualité du retrieval.