# n8n — Workflows

Deux workflows sont créés dans l'instance n8n (https://n8n.samensteeve.com, projet personnel). Le code source de chaque workflow est versionné ici (`.ts`, SDK `@n8n/workflow-sdk`) pour être re-créé/modifié par code.

## Workflow 1 — `Second Brain — Ingestion`

**Rôle** : indexer les notes du vault dans Qdrant.

```
Webhook (POST /webhook/second-brain/ingest)
        │
        ▼
Default Data Loader (JSON entrant)
        │
        ▼
Splitter Markdown (chunks 800 / overlap 100)
        │
        ▼
OpenAI Embeddings (text-embedding-3-small)
        │
        ▼
Qdrant Insert (collection: knowledge_base)
```

- **URL** : `https://n8n.samensteeve.com/webhook/second-brain/ingest`
- **Payload attendu** : tableau JSON d'objets `{ text, file, category, tags, status }`.
- **Workflow** : https://n8n.samensteeve.com/workflow/PGv3RgcPM4AgWoFQ
- **Déclenchement** : le script `obsidian/sync.ps1` (local) envoie les notes modifiées.

## Workflow 2 — `Second Brain — Ask`

**Rôle** : répondre à une question à partir du contexte indexé.

```
Webhook (POST /webhook/second-brain/ask, header auth)
        │
        ▼
Normaliser la question
        │
        ▼
OpenAI Embeddings (question)
        │
        ▼
Qdrant Search (topK 8, collection: knowledge_base)
        │
        ▼
Contexte + Question (sources citées)
        │
        ▼
OpenAI Chat Model (gpt-5-mini, température 0.2)
        │
        ▼
Réponse JSON { answer, sources }
```

- **URL** : `https://n8n.samensteeve.com/webhook/second-brain/ask`
- **Authentification** : header de la credential **« Header Auth account »** (déjà existante) — utilise le même header pour tes appels.
- **Workflow** : https://n8n.samensteeve.com/workflow/etuAL8GU7Impxbuz
- **Exemple** :
  ```bash
  curl -X POST https://n8n.samensteeve.com/webhook/second-brain/ask \
    -H "Content-Type: application/json" \
    -H "<header>: <valeur de ta credential Header Auth>" \
    -d '{"question": "Quels sont mes projets Java Spring Boot ?"}'
  ```

## Credentials requises

| Credential n8n | État | Rôle |
|---|---|---|
| OpenAI account | ✅ Existe (auto-attribuée) | Embeddings + Chat |
| Header Auth account | ✅ Existe (auto-attribuée) | Auth du webhook Ask |
| **Qdrant** | ❌ **À créer** | Upsert + Search |

### Créer la credential Qdrant

1. **Lancer Qdrant** là où n8n peut y accéder (ex. sur le serveur n8n) :
   ```bash
   docker compose -f infrastructure/docker/docker-compose.yml up -d
   ```
   (ou `docker run -d -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant`)
2. Dans n8n : **Credentials → Add credential → Qdrant**
   - Host : `http://localhost:6333` (ou IP du serveur)
   - Port : `6333`
   - API Key : vide (aucune configurée par défaut)
   - Collection : `knowledge_base`

## Usage

```powershell
# Indexer tout le vault (1er index)
powershell -File D:\Documents\sam-second-brain-vault\..\sam-second-brain\obsidian\sync.ps1

# Ou depuis le vault directement
powershell -File obsidian\sync.ps1
```

> ⚠️ V1 : le sync envoie toutes les notes à chaque exécution (upsert). Une ré-indexation complète est sans risque mais réécrit les points — si tu veux repartir de zéro : vider la collection `knowledge_base` dans Qdrant puis relancer le sync.
> ⚠️ Tant que la credential **Qdrant** n'existe pas, les deux workflows échouent à l'étape Qdrant.