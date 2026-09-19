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
OpenCode Go — Chat (HTTP POST chat/completions)
  deepseek-v4-flash-vision-exp · header x-opencode-session
        │
        ▼
Extraire la réponse (Code)
        │
        ▼
Réponse JSON { answer, sources }
```

- **URL de production** : `https://n8n.samensteeve.com/webhook/1b0e8559-8633-417a-93ba-33e65fc3ade6/second-brain/ask`
- **Authentification** : header **`n8n-webhook-secret`** (credential « Header Auth account ») — la valeur est celle configurée dans la credential.
- **Workflow** : https://n8n.samensteeve.com/workflow/aNIEqBj2T0CPZDYS
- **Exemple** :
  ```bash
  curl -X POST "https://n8n.samensteeve.com/webhook/1b0e8559-8633-417a-93ba-33e65fc3ade6/second-brain/ask" \
    -H "Content-Type: application/json" \
    -H "n8n-webhook-secret: <valeur de ta credential Header Auth>" \
    -d '{"question": "Quels sont mes projets Java Spring Boot ?"}'
  ```

## Workflow 3 — `Second Brain — MCP Server` ✅ (scoped)

**Rôle** : expose la base de connaissances à **n'importe quelle IA compatible MCP** (ChatGPT, Claude, Cursor, opencode…) via un serveur MCP dédié — **uniquement** l'outil `second_brain_ask`, sans les outils d'administration n8n.

```
MCP Server Trigger (mcpTrigger, path: second-brain-kb, bearer auth)
        │  ai_tool
        ▼
Custom Workflow Tool (second_brain_ask)
        │  → exécute
        ▼
Second Brain — KB Query (sous-workflow RAG)
  question → Ollama bge-m3 → Qdrant → DeepSeek V4 Flash Vision → { answer, sources }
```

- **Workflow MCP** : https://n8n.samensteeve.com/workflow/vsiodb4KRTTEVBju
- **Sous-workflow RAG** : https://n8n.samensteeve.com/workflow/dWn9Dm1dvc5Qi13H
- **URL MCP** : `https://n8n.samensteeve.com/mcp-server/second-brain-kb` (production, après publication)
- **Auth** : `Bearer <token>` — credential « MCP Second Brain ».

### Brancher une IA

1. Crée la credential **« MCP Second Brain »** (type *HTTP Bearer Auth*) avec un token que tu choisis (ex. généré par `openssl rand -hex 24`), et rattache-la au nœud **« MCP Server — Second Brain »** (⚠️ pas la credential « Bearer Auth account »).
2. Publie le workflow **« Second Brain — MCP Server »** (n8n → active).
3. Dans ton IA (ChatGPT / Claude Desktop / Cursor / opencode…) : ajoute un **serveur MCP**
   - URL : `https://n8n.samensteeve.com/mcp-server/second-brain-kb`
   - Auth : Bearer avec ton token
4. L'IA découvre l'outil **`second_brain_ask`** et interroge ta base de connaissances.

### Sécurité

- Ce serveur n'expose **que** `second_brain_ask` (pas d'admin n8n).
- Le token est à toi : ne le partage pas (qui l'a = accès à tes notes).

## Credentials requises

| Credential n8n | Type | État | Rôle |
|---|---|---|---|
| **Ollama** | ollamaApi | ✅ Existe | Embeddings locaux (base URL `http://ollama:11434`) |
| **OpenCode Go** | httpBearerAuth (« Bearer Auth account 2 ») | ✅ Existe | Génération (chat) — clé `opencode-go` |
| **MCP Second Brain** | httpBearerAuth | ❌ **À créer** | Auth du serveur MCP dédié (token au choix) |
| Header Auth account | httpHeaderAuth | ✅ Existe | Auth webhook Ask (header `n8n-webhook-secret`) |
| **GitHub token** | httpBearerAuth (« Bearer Auth account ») | ✅ Existe | Lecture API GitHub (repo privé) |
| **Qdrant account** | qdrantApi | ✅ Existe | Upsert + Search |

### Créer la credential « OpenCode Go »

1. Dans n8n : **Credentials → Add → HTTP Request → Bearer Auth**
   - Name : `OpenCode Go`
   - **Token** : ta clé `opencode-go` (celle d'opencode, dans `auth.json`)
2. Rattache-la au nœud **« OpenCode Go — Chat »** du workflow Ask.

> La passerelle OpenCode Go (`https://opencode.ai/zen/go/v1`) exige le header `x-opencode-session` — il est déjà configuré sur le nœud HTTP. Modèle : `deepseek-v4-flash-vision-exp`.

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

- **Pourquoi des embeddings locaux ?** Pas de clé API supplémentaire, et confidentialité : l'indexation des notes reste sur le VPS (voir `docs/decisions/ADR-003-embeddings-locaux-ollama.md`).
- **Modèle de chat** : `deepseek-v4-flash-vision-exp` via la passerelle **OpenCode Go** (`https://opencode.ai/zen/go/v1`), la même que celle utilisée par opencode (header `x-opencode-session` requis).
- **Dimension de la collection** : 1024 (bge-m3). Ne pas changer de modèle d'embeddings sans ré-indexer.
- **L'ancien workflow « webhook ingestion »** a été archivé ; `obsidian/sync.ps1` reste un fallback manuel.