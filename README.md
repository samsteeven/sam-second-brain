# sam-second-brain

> Mon second cerveau personnel : une base de connaissances Markdown (Obsidian) rendue interrogeable par l'IA grâce à un pipeline **Obsidian → Git → n8n → Qdrant → LLM (RAG)**.

## Le problème

À chaque conversation avec une IA, je dois réexpliquer mon contexte : qui je suis, mes études, mes projets, mes compétences, mon CV. Le contexte est dispersé, jamais à jour, et les IA n'ont pas de mémoire durable exploitable.

## La solution

```
┌───────────────┐     ┌───────┐     ┌──────────────┐     ┌──────────┐     ┌──────┐
│   OBSIDIAN    │────▶│  GIT  │────▶│     n8n      │────▶│  QDRANT  │────▶│ LLM  │
│  source de    │ MD  │version│     │ ingestion /  │ vec │ vector   │ sem │OpenAI│
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
| Embeddings | OpenAI `text-embedding-3-small` | Standard RAG, qualité/prix optimal |
| LLM | OpenAI `gpt-4o-mini` | Réponses rapides et économiques |
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
│       └── ADR-002-openai.md
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

> ⚠️ **Le vault personnel (mes données) n'est pas dans ce repo public.** Il vit localement dans `sam-second-brain-vault/` (voir `obsidian/README.md`).

## Démarrer

1. **Qdrant** : le lancer sur le VPS — `docker compose -f infrastructure/docker/docker-compose.yml up -d`
2. **Vault** : ouvrir `sam-second-brain-vault/` dans Obsidian ; les modifications sont pushées sur le repo **privé** `sam-second-brain-vault`.
3. **n8n** : les workflows « Ingestion (GitHub) » et « Ask » sont déjà créés. Créer les credentials **« GitHub token »** (Bearer, accès Contents:Read au repo privé) et **« Qdrant »** (host/port/collection).
4. Poser une question au webhook de réponse et obtenir une réponse contextuelle.

## Feuille de route

- [x] Conception V1 (architecture, ADR)
- [x] Infrastructure Docker (Qdrant)
- [x] Templates Obsidian
- [x] Workflow n8n — Ingestion (repo GitHub privé, schedule 30 min)
- [x] Workflow n8n — Ask (webhook → Qdrant → GPT)
- [ ] Interface chat (Telegram / WhatsApp)
- [ ] Capture automatique (veille, idées)
- [ ] Article LinkedIn + documentation publique

## Licence

Private use. Projet personnel.