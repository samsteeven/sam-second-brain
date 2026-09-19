# n8n — Workflows

Deux workflows sont créés dans l'instance n8n (https://n8n.samensteeve.com, projet personnel). Le code source de chaque workflow est versionné ici (`.ts`, SDK `@n8n/workflow-sdk`) pour être re-créé/modifié par code.

## Workflow 1 — `Second Brain — Ingestion (GitHub)` ✅ actif

**Rôle** : re-indexe automatiquement le vault depuis le repo GitHub **privé** `samsteeven/sam-second-brain-vault`, toutes les 30 min.

```
Schedule Trigger (30 min)
        │
        ▼
Qdrant — Vider la collection (knowledge_base)
        │
        ▼
GitHub — Arbre du vault (git trees recursive)
        │
        ▼
Code — Filtrer les notes .md (hors .obsidian/templates)
        │
        ▼
Pour chaque note (splitInBatches)
        │   GitHub — Contenu (API, base64)
        │   Code — Décoder + frontmatter (type/tags/status)
        ▼
Qdrant — Indexer (chunks 800 / overlap 100 → embeddings OpenAI → insert)
```

- **Workflow** : https://n8n.samensteeve.com/workflow/yzhue0OUIpyhqIUT
- **Principe** : ré-indexation complète à chaque run (vide la collection puis re-remplit) → pas de doublons.
- **Vault** : repo **privé** `samsteeven/sam-second-brain-vault` — aucune donnée publique.

### Flux d'édition (côté toi)

1. Édite tes notes dans Obsidian (desktop ou mobile).
2. Committe + push vers le repo privé (`git add . && git commit -m "..." && git push`).
3. n8n re-indexe automatiquement sous 30 min (ou manuellement dans n8n).

## Workflow 2 — `Second Brain — Ask` ✅ actif

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
- **Authentification** : header de la credential **« Header Auth account »** — utilise le même header pour tes appels.
- **Workflow** : https://n8n.samensteeve.com/workflow/etuAL8GU7Impxbuz
- **Exemple** :
  ```bash
  curl -X POST https://n8n.samensteeve.com/webhook/second-brain/ask \
    -H "Content-Type: application/json" \
    -H "<header>: <valeur de ta credential Header Auth>" \
    -d '{"question": "Quels sont mes projets Java Spring Boot ?"}'
  ```

## Credentials requises

| Credential n8n | Type | État | Rôle |
|---|---|---|---|
| OpenAI account | openAiApi | ✅ Existe (auto-attribuée) | Embeddings + Chat |
| Header Auth account | httpHeaderAuth | ✅ Existe (auto-attribuée) | Auth webhook Ask |
| **GitHub token** | httpBearerAuth | ❌ **À créer** | Lecture API GitHub (repo privé) |
| **Qdrant** | qdrantApi | ❌ **À créer** | Upsert + Search |

### 1. Créer la credential « GitHub token »

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** → Generate.
   - Repository access : **Only select repositories** → `sam-second-brain-vault`
   - Permissions → Contents : **Read** (et Metadata : Read, automatique)
2. Dans n8n : **Credentials → Add → HTTP Request → Bearer Token Auth** (ou `HTTP Bearer Auth`)
   - Name : `GitHub token`
   - Token : `github_pat_...` (le token généré)

### 2. Créer la credential « Qdrant »

1. **Lancer Qdrant** sur le VPS (là où n8n peut y accéder) :
   ```bash
   mkdir -p second-brain && cd second-brain
   curl -o docker-compose.yml https://raw.githubusercontent.com/samsteeven/sam-second-brain/main/infrastructure/docker/docker-compose.yml
   docker compose up -d
   ```
2. Dans n8n : **Credentials → Add → Qdrant**
   - Host : `http://localhost:6333` (ou IP du serveur)
   - Port : `6333`
   - API Key : vide
   - Collection : `knowledge_base`

## FAQ

- **Pourquoi un repo privé ?** Le vault contient des données personnelles. Le repo public `sam-second-brain` ne contient QUE du code, des templates et de la doc — jamais les notes.
- **L'ancien workflow « webhook ingestion »** a été archivé (remplacé par la version GitHub). Le script `obsidian/sync.ps1` reste disponible comme fallback manuel si besoin.