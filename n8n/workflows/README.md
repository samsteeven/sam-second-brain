# n8n — Workflows

Sept workflows sont créés dans l'instance n8n (https://n8n.samensteeve.com, projet personnel). Le code source de chaque workflow est versionné ici (`.ts`, SDK `@n8n/workflow-sdk`) pour être re-créé/modifié par code.

## Workflow 1 — `Second Brain — Ingestion (GitHub)` ✅

**Rôle** : re-indexe automatiquement le vault depuis le repo GitHub **privé** `samsteeven/sam-second-brain-vault`, toutes les 30 min.

```
Schedule Trigger (30 min)
        │
        ▼
GitHub — Arbre du vault (git trees recursive)
        │
        ▼
Code — Filtrer les notes .md (hors .obsidian/templates)
        │
        ▼
GitHub — Contenu de la note (API, base64)   [un appel par note]
        │
        ▼
Code — Décoder + frontmatter (type/tags/status)
        │   ⚠️ exclut les notes `status: pending` (quarantaine)
        ▼
Code — Chunker + IDs déterministes (UUID = hash fichier + index)
        │
        ▼
HTTP — Ollama /api/embed (bge-m3, batch)
        │
        ▼
Code — Construire les points { id, vector, payload:{content, metadata} }
        │
        ▼
HTTP — Qdrant Upsert (PUT /points?wait=true)
        │
        ▼
HTTP — Qdrant Nettoyage orphelins (must_not has_id)
```

- **Workflow** : https://n8n.samensteeve.com/workflow/OW8VnLftG984yErF
- **Principe** : **upsert à IDs déterministes** → **idempotent** (deux exécutions concurrentes produisent le même index, sans doublon). Le nettoyage des orphelins gère les notes supprimées/raccourcies. Aucun vidage de collection → pas de fenêtre où la base est vide.
- **Quarantaine** : les notes écrites par une IA (`second_brain_add`) arrivent avec `status: pending` → **jamais indexées** tant que tu ne les valides pas (passe `status` à `active` dans Obsidian/GitHub, ou supprime-les).
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

## Workflow 3 — `Second Brain — MCP Server` ✅ (scoped, lecture + écriture)

**Rôle** : expose la base de connaissances à **n'importe quelle IA compatible MCP** (ChatGPT, Claude, Cursor, opencode…) via un serveur MCP dédié — **uniquement** les outils du second cerveau, sans les outils d'administration n8n.

```
MCP Server Trigger (mcpTrigger, path: second-brain-kb, bearer auth)
        │ ai_tool              │ ai_tool              │ ai_tool
        ▼                      ▼                      ▼
second_brain_ask        second_brain_add      second_brain_project_details
  (lit la base)           (écrit une note)       (lit la source GitHub)
        │                      │                      │
        ▼                      ▼                      ▼
Second Brain — KB Query  Second Brain — Add Note  Second Brain — Project Details
 question → Ollama →      note markdown → GitHub    README/fichier GitHub
 Qdrant → DeepSeek        (99-Capture/, pending)    (repo ou repo#chemin)
```

- **Outils** :
  - `second_brain_ask` — répond depuis la base (projets, stack, CV, notes) avec sources.
  - `second_brain_add` — ajoute une note markdown dans le vault privé avec `status: pending`, auto-classée (type/tags/dossier), dédupliquée. **Elle n'est indexée qu'après validation humaine**. Arguments : `input` (contenu markdown).
  - `second_brain_project_details` — **plonge dans la source** d'un projet (GitHub) : README ou fichier précis, à la demande. Format de `input` : `repo` ou `repo#chemin` (ex. `tribunejustice#app/Services/Payment/EscrowService.php`). Aliases connus : tribunejustice, easypharma, second-brain, sigge, digitrans, portfolio, services, portfolio-adonisjs, taskmanager… ou un `owner/repo` complet.
  - ⚠️ **Credential « Github Read »** : token **classic** (scope `repo`) utilisé par `second_brain_project_details` pour lire TOUS les repos accessibles (tes repos + ceux où tu es contributeur : TBJ org, ngomade/sigge…). Les fine-grained tokens ne couvrent pas les repos personnels d'autres comptes.

## 🔒 Matrice des credentials GitHub (audit)

**Règle d'or : `Github Read` (token classic, capable d'écrire) n'est JAMAIS utilisé sur une écriture.**

| Workflow | Nœud | Méthode | Credential |
|---|---|---|---|
| Second Brain — Project Details | GitHub — Détail | GET (lecture) | **Github Read** |
| Second Brain — Project Details | GitHub — Racine | GET (lecture) | **Github Read** |
| Second Brain — Add Note | GitHub — Créer la note | PUT (**écriture**) | Bearer Auth account (fine-grained, vault uniquement) |
| Second Brain — Housekeeping | GitHub — Arbre / Contenu / Écrire le rapport | GET + PUT (**écriture** du rapport) | Bearer Auth account (fine-grained, vault uniquement) |
| Second Brain — Ingestion | GitHub — Arbre / Contenu | GET (lecture) | Bearer Auth account (fine-grained) |

Garanties :
- `Github Read` n'est branché que sur les 2 nœuds **GET** de l'outil de lecture.
- Les écritures utilisent **exclusivement** la fine-grained « Bearer Auth account », limitée à `sam-second-brain-vault` (Contenus: Read + Write sur ce repo seulement).
- Les URLs d'écriture sont codées en dur vers `samsteeven/sam-second-brain-vault` → impossible d'écrire ailleurs.
- **Workflow MCP** : https://n8n.samensteeve.com/workflow/vsiodb4KRTTEVBju
- **Sous-workflows** : KB Query (`dWn9Dm1dvc5Qi13H`) · Add Note (`MzpwDShhgx4nte2U`) · Project Details (`CNBjukh9nqhGDPbc`)
- **URL MCP (production)** : `https://n8n.samensteeve.com/mcp/second-brain-kb`
- **Auth** : `Bearer <token>` — credential « MCP Second Brain ».

### Brancher une IA

1. Crée la credential **« MCP Second Brain »** (type *HTTP Bearer Auth*) avec un token que tu choisis (ex. généré par `openssl rand -hex 24`), et rattache-la au nœud **« MCP Server — Second Brain »** (⚠️ pas la credential « Bearer Auth account »).
2. Publie le workflow **« Second Brain — MCP Server »** (n8n → active).
3. Dans ton IA (ChatGPT / Claude Desktop / Cursor / opencode…) : ajoute un **serveur MCP**
   - URL : `https://n8n.samensteeve.com/mcp/second-brain-kb`
   - Auth : Bearer avec ton token
4. L'IA découvre les 3 outils (**`second_brain_ask`**, **`second_brain_add`**, **`second_brain_project_details`**) — argument `input`/`query` — et interroge ta base de connaissances.

### Sécurité

- Ce serveur n'expose **que** `second_brain_ask`, `second_brain_add` et `second_brain_project_details` (pas d'admin n8n).
- Le token est à toi : ne le partage pas (qui l'a = accès à tes notes).
- **Validation des écritures IA** : `second_brain_add` écrit les notes en `status: pending` (quarantaine) → **jamais indexées** tant que tu ne les passes pas à `active`. Contre les prompt injections et le hors-contexte : le pire qu'une IA puisse faire est d'écrire une note en quarantaine, invisible et réversible (Git).

## Workflow 4 — `Second Brain — Housekeeping` ✅

**Rôle** : détecte les **notes redondantes** dans la base et écrit un **rapport** en quarantaine, chaque semaine.

```
Schedule (dimanche 8h)
        │
        ▼
GitHub — Arbre + Contenu (toutes les notes)
        │
        ▼
Pour chaque note (splitInBatches)
        │   Ollama — Embed (bge-m3)
        │   Qdrant — Search (top 5, similarité)
        │   Code — Candidat doublon (hors soi-même, > 70 %)
        ▼
Code — Construire le rapport (paires dédoublonnées)
        │
        ▼
GitHub — Écrire le rapport → 99-Capture/housekeeping-<date>.md (status: pending)
```

- **Workflow** : https://n8n.samensteeve.com/workflow/IhNRKZe1WGnBEe5s
- Le rapport est `status: pending` → **non indexé** ; tu le lis et tu valides/refuses.

## Workflow 5 — `Second Brain — Project Details` ✅ (lecture source à la demande)

**Rôle** : donner à une IA branchée en MCP la capacité de **plonger dans la source** d'un projet (GitHub) — README ou fichier précis — sans stocker tout le code dans le vault.

```
MCP (second_brain_project_details) / exécution directe
        │  input = "repo" ou "repo#chemin"
        ▼
Normaliser la cible (alias → owner/repo)
        │
        ├─ si pas de chemin → GitHub — Racine (liste des fichiers)
        └─ sinon            → GitHub — Détail (contenu du fichier)
        ▼
Retour { ok, repo, path, content }
```

- **Workflow** : https://n8n.samensteeve.com/workflow/CNBjukh9nqhGDPbc
- **Aliases connus** : tribunejustice, easypharma (+frontend/flutter), second-brain, sigge, digitrans, portfolio, portfolio-adonisjs, services, taskmanager… ou un `owner/repo` complet.
- **Credential** : **`Github Read`** (token classic, scope `repo`) — lecture seule, jamais utilisée en écriture (voir la matrice ci-dessous).

## Qualité du contenu (anti-redondance, anti-mal-classé)

- **`second_brain_add` classe automatiquement** chaque note (type, tags, dossier cible) via une passe LLM (DeepSeek) — `06-Knowledge/…`, `03-Projects/…`, `05-Skills/…` selon le contenu.
- **`second_brain_add` vérifie les doublons** avant d'écrire : similarité sémantique contre la base → refus si ≥ 75 %, avertissement si ≥ 55 %.
- **Housekeeping** signale chaque semaine les paires redondantes existantes.

## Credentials requises

| Credential n8n | Type | État | Rôle |
|---|---|---|---|
| **Ollama** | ollamaApi | ✅ Existe | Embeddings locaux (base URL `http://ollama:11434`) |
| **OpenCode Go** | httpBearerAuth (« Bearer Auth account 2 ») | ✅ Existe | Génération (chat) — clé `opencode-go` |
| **MCP Second Brain** | httpBearerAuth | ✅ Existe | Auth du serveur MCP dédié |
| Header Auth account | httpHeaderAuth | ✅ Existe | Auth webhook Ask (header `n8n-webhook-secret`) |
| **GitHub token** | httpBearerAuth (« Bearer Auth account ») | ✅ Existe — **Contents: Read + Write** | Lecture (ingestion) + écriture (second_brain_add) |
| **Github Read** | httpBearerAuth (token **classic**, scope `repo`) | ✅ Existe | Lecture seule multi-repos (outil `project_details`) |
| **Qdrant account** | qdrantApi | ✅ Existe | Upsert + Search |

> ⚠️ Le token GitHub doit avoir **Contents: Read AND write** sur `sam-second-brain-vault` (nécessaire pour l'outil `second_brain_add`).

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

Fine-grained PAT, accès **`sam-second-brain-vault`** en *Contents: Read **and Write*** (l'écriture est nécessaire pour `second_brain_add`). Credential n8n de type *HTTP Bearer Auth*, champ = le token seul (sans `Bearer`).

### Qdrant (rappel)

Host `http://qdrant:6333`, port `6333`, collection `knowledge_base`.

## FAQ

- **Pourquoi des embeddings locaux ?** Pas de clé API supplémentaire, et confidentialité : l'indexation des notes reste sur le VPS (voir `docs/decisions/ADR-003-embeddings-locaux-ollama.md`).
- **Modèle de chat** : `deepseek-v4-flash-vision-exp` via la passerelle **OpenCode Go** (`https://opencode.ai/zen/go/v1`), la même que celle utilisée par opencode (header `x-opencode-session` requis).
- **Dimension de la collection** : 1024 (bge-m3). Ne pas changer de modèle d'embeddings sans ré-indexer.
- **L'ancien workflow « webhook ingestion »** a été archivé ; `obsidian/sync.ps1` reste un fallback manuel.