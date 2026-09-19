# n8n — Workflows

Deux workflows sont créés dans l'instance n8n (https://n8n.samensteeve.com, projet personnel). Le code source de chaque workflow est versionné ici (`.ts`, SDK `@n8n/workflow-sdk`) pour être re-créé/modifié par code.

## Workflow 1 — `Second Brain — Ingestion (GitHub)` ✅

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
Qdrant — Indexer (chunks 800 / overlap 100 → embeddings Ollama bge-m3 → insert)
```

- **Workflow** : https://n8n.samensteeve.com/workflow/yzhue0OUIpyhqIUT
- **Principe** : ré-indexation complète à chaque run (vide la collection puis re-remplit) → pas de doublons.
- **Vault** : repo **privé** `samsteeven/sam-second-brain-vault` — aucune donnée publique.

### Flux d'édition (côté toi)

1. Édite tes notes dans Obsidian (desktop ou mobile).
2. Committe + push vers le repo privé (`git add . && git commit -m "..." && git push`).
3. n8n re-indexe automatiquement sous 30 min (ou manuellement dans n8n).

## Workflow 2 — `Second Brain — Ask` ✅

**Rôle** : répondre à une question à partir du contexte indexé.

```
Webhook (POST, header auth)
        │
        ▼
Normaliser la question
        │
        ▼
Ollama Embeddings (bge-m3) — embedding de la question
        │
        ▼
Qdrant Search (topK 8, collection: knowledge_base)
        │
        ▼
Contexte + Question (sources citées)
        │
        ▼
OpenRouter Chat Model (openai/gpt-4.1-mini, température 0.2)
        │
        ▼
Réponse JSON { answer, sources }
```

- **URL de production** : `https://n8n.samensteeve.com/webhook/3bfad0e2-b19b-4557-a661-b35aed399acb/second-brain/ask`
- **Authentification** : header **`n8n-webhook-secret`** (credential « Header Auth account ») — la valeur est celle configurée dans la credential.
- **Workflow** : https://n8n.samensteeve.com/workflow/etuAL8GU7Impxbuz
- **Exemple** :
  ```bash
  curl -X POST "https://n8n.samensteeve.com/webhook/3bfad0e2-b19b-4557-a661-b35aed399acb/second-brain/ask" \
    -H "Content-Type: application/json" \
    -H "n8n-webhook-secret: <valeur de ta credential Header Auth>" \
    -d '{"question": "Quels sont mes projets Java Spring Boot ?"}'
  ```

## Credentials requises

| Credential n8n | Type | État | Rôle |
|---|---|---|---|
| **Ollama** | ollamaApi | ❌ **À créer** | Embeddings locaux (base URL `http://ollama:11434`) |
| OpenRouter account | openRouterApi | ✅ Existe | Génération (chat) |
| Header Auth account | httpHeaderAuth | ✅ Existe | Auth webhook Ask (header `n8n-webhook-secret`) |
| **GitHub token** | httpBearerAuth | ✅ Existe (« Bearer Auth account ») | Lecture API GitHub (repo privé) |
| **Qdrant account** | qdrantApi | ✅ Existe | Upsert + Search |

### Créer la credential « Ollama »

1. Ollama est **déjà déployé** sur le VPS (conteneur `ollama`, réseau `n8n_n8n`) avec le modèle `bge-m3`.
2. Dans n8n : **Credentials → Add → Ollama**
   - Base URL : `http://ollama:11434`
3. Rattache-la aux nœuds **« Ollama Embeddings »** (présents dans les deux workflows).

### GitHub token (rappel)

Fine-grained PAT, accès **`sam-second-brain-vault`** en *Contents: Read*. Credential n8n de type *HTTP Bearer Auth*, champ = le token seul (sans `Bearer`).

### Qdrant (rappel)

Host `http://qdrant:6333`, port `6333`, collection `knowledge_base`.

## FAQ

- **Pourquoi des embeddings locaux ?** Pas de clé OpenAI, et confidentialité : l'indexation des notes reste sur le VPS (voir `docs/decisions/ADR-003-embeddings-locaux-ollama.md`).
- **Dimension de la collection** : 1024 (bge-m3). Ne pas changer de modèle d'embeddings sans ré-indexer.
- **L'ancien workflow « webhook ingestion »** a été archivé ; `obsidian/sync.ps1` reste un fallback manuel.