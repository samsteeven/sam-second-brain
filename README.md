# sam-second-brain

> Mon second cerveau personnel : une base de connaissances Markdown (Obsidian) rendue interrogeable par l'IA grâce à un pipeline **Obsidian → Git → n8n → Qdrant → LLM (RAG)**.

## Le problème

À chaque conversation avec une IA, je dois réexpliquer mon contexte : qui je suis, mes études, mes projets, mes compétences, mon CV. Le contexte est dispersé, jamais à jour, et les IA n'ont pas de mémoire durable exploitable.

## La solution

```
┌───────────────┐     ┌───────┐     ┌──────────────┐     ┌──────────┐     ┌──────┐
│   OBSIDIAN    │────▶│  GIT  │────▶│     n8n      │────▶│  QDRANT  │────▶│ LLM  │
│  source de    │ MD  │version│     │ ingestion /  │ vec │ vector   │ sem │OpenR.│
│  vérité       │     │ing    │     │ chunking /   │     │ store    │search     │
│               │     │       │     │ embeddings   │     │          │     │      │
└───────────────┘     └───────┘     └──────────────┘     └──────────┘     └──────┘
                                                                              │
                                                                              ▼
                                                                       réponse avec
                                                                       mon contexte
```

**Obsidian = mémoire externe structurée. n8n = moteur d'ingestion et d'orchestration. Qdrant = index sémantique. LLM = intelligence qui interroge la mémoire.**

## V1 — fonctionnalités

- **Ingestion automatique** : les notes Markdown modifiées sont chunkées, embarquées et indexées dans Qdrant.
- **Question → réponse contextuelle** : une question est traduite en embedding, les chunks pertinents sont retrouvés, et le LLM répond uniquement à partir de ce contexte (RAG).
- **Templates Obsidian** : notes normalisées (profil, projet, compétence, réunion, idée, décision) avec métadonnées YAML pour un filtrage fiable.
- **Versioning Git** : historique complet du second cerveau.

## Stack

| Composant | Choix | Pourquoi |
|---|---|---|
| Notes | Obsidian (Markdown + YAML) | Contrôle total, format universel, automatisable |
| Versioning | Git / GitHub | Historique, diff, n8n détecte les changements |
| Orchestration | n8n | Workflows visuels, déjà utilisé dans mon écosystème |
| Vector store | Qdrant (Docker) | Open-source, self-hosted, rapide, métadonnées riches |
| Embeddings | **Ollama `bge-m3`** (local, VPS) | Multilingue (FR), aucun coût API, notes non envoyées à un tiers |
| LLM | **OpenRouter `openai/gpt-4.1-mini`** | Réponses rapides et économiques |
| Interface | Webhook / Chat (n8n) | Simple, extensible (Telegram, WhatsApp…) |

## Structure du repo

```
sam-second-brain/
├── README.md
├── docs/
│   ├── architecture.md          # Architecture détaillée V1
│   ├── security.md              # Secrets, confidentialité, isolation
│   └── decisions/               # ADR — décisions d'ingénierie documentées
│       ├── ADR-001-qdrant.md
│       ├── ADR-002-openai.md              # SUPERSÉDÉ (historique)
│       ├── ADR-003-embeddings-locaux-ollama.md
│       ├── ADR-004-opencode-go-generation.md
│       ├── ADR-005-mcp-dedie.md
│       └── ADR-006-validation-humaine-ecritures-ia.md
├── infrastructure/
│   └── docker/
│       └── docker-compose.yml   # Qdrant
├── n8n/
│   └── workflows/               # Descriptions des workflows (ingestion + ask)
├── obsidian/
│   ├── templates/               # Templates de notes
│   └── examples/                # Exemples de notes
└── .gitignore
```

> ⚠️ **Le vault personnel (mes données) n'est pas dans ce repo public.** Il vit localement + sur le repo **privé** `samsteeven/sam-second-brain-vault` (voir `obsidian/README.md`).

## Démarrer

1. **Qdrant** : le lancer sur le VPS — `docker compose -f infrastructure/docker/docker-compose.yml up -d`
2. **Vault** : ouvrir `sam-second-brain-vault/` dans Obsidian ; les modifications sont pushées sur le repo **privé** `sam-second-brain-vault`.
3. **n8n** : les workflows sont déjà créés et actifs (Ingestion, KB Query, Add Note, MCP Server). Les credentials nécessaires : Ollama, OpenCode Go, GitHub (Contents: Read+Write), Qdrant, MCP Second Brain — voir `n8n/workflows/README.md`.
4. **Brancher une IA** : ajouter un serveur MCP avec l'URL `https://n8n.samensteeve.com/mcp/second-brain-kb` + le token Bearer → l'IA découvre `second_brain_ask` et `second_brain_add`.

## Décisions d'ingénierie

Chaque choix structurant est documenté dans `docs/decisions/` (ADR) :

| Décision | ADR | Pourquoi |
|---|---|---|
| Qdrant (self-hosted) pour le vector store | ADR-001 | Données sous contrôle, métadonnées riches, intégration n8n |
| ~~OpenAI~~ (abandonné) | ADR-002 | Historique — pas de clé, pas de fonds |
| Embeddings locaux Ollama `bge-m3` | ADR-003 | Multilingue FR, zéro coût API, confidentialité |
| Génération via OpenCode Go (DeepSeek V4 Flash Vision) | ADR-004 | Réutilise la clé opencode existante, modèle vision |
| Serveur MCP dédié (scoped) | ADR-005 | Expose uniquement lecture + écriture, pas l'admin n8n |
| Validation humaine des écritures IA (quarantaine) | ADR-006 | Anti prompt-injection : rien n'entre sans validation |

## Feuille de route

- [x] Conception V1 (architecture, ADR)
- [x] Infrastructure Docker (Qdrant)
- [x] Templates Obsidian
- [x] Workflow n8n — Ingestion (repo GitHub privé, schedule 30 min, notes pending exclues)
- [x] Workflow n8n — Ask / KB Query (Ollama → Qdrant → DeepSeek V4 Flash Vision)
- [x] Serveur MCP dédié (lecture + écriture, validation humaine des écritures IA)
- [x] Quarantaine : les notes écrites par IA sont `pending` jusqu'à validation
- [ ] Interface chat (Telegram / WhatsApp)
- [ ] Capture automatique (veille, idées)
- [ ] Article LinkedIn + documentation publique

## Licence

Private use. Projet personnel.