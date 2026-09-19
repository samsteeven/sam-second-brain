# n8n — Workflows

Deux workflows construisent le second cerveau. Ils sont créés dans l'instance n8n via l'API/SDK (voir le repo racine pour le code source de chaque workflow).

## Workflow 1 — `second-brain-ingestion`

**Rôle** : indexer les notes modifiées du vault dans Qdrant.

```
Schedule / Manual Trigger
        │
        ▼
Read Markdown (dossier vault ou clone Git)
        │
        ▼
Clean & Split (chunking par sections)
        │
        ▼
OpenAI Embeddings (text-embedding-3-small)
        │
        ▼
Qdrant Upsert (collection: knowledge_base)
```

- **Déclencheur** : manuel (dev) + schedule (production, ex. toutes les 30 min).
- **Idempotence** : `id` = slug du fichier + n° de chunk → pas de doublons à la ré-indexation.
- **Payload** : `text`, `file`, `category` (depuis le frontmatter), `tags`, `updated_at`.

## Workflow 2 — `second-brain-ask`

**Rôle** : répondre à une question à partir du contexte du vault.

```
Webhook / Chat Trigger
        │
        ▼
OpenAI Embeddings (question)
        │
        ▼
Qdrant Search (top-K, filtre optionnel par catégorie/tags)
        │
        ▼
Prompt (SYSTEM + CONTEXT + QUESTION)
        │
        ▼
OpenAI gpt-4o-mini
        │
        ▼
Réponse (avec sources citées)
```

- **Authentification du webhook** : header `X-API-Key` si exposé publiquement.
- **Garde-fou anti-hallucination** : le prompt impose « réponds UNIQUEMENT à partir du CONTEXT, sinon dis-le ».

## Credentials requises

| Credential n8n | Service | Rôle |
|---|---|---|
| OpenAI | OpenAI | Embeddings + Chat completions |
| Qdrant | Qdrant (http://localhost:6333) | Upsert + Search |
| (Optionnel) GitHub | GitHub | Lecture du vault versionné |

## Import manuel (si les workflows ne sont pas créés directement)

Les exports JSON de chaque workflow peuvent être ré-importés via **Workflows → Import from File**.