# ADR-002 — OpenAI pour embeddings et LLM

- **Statut** : Accepté (2026-09-19)
- **Décideur** : Samen Steeve

## Contexte

Le RAG a besoin de deux modèles : un modèle d'embeddings (indexation + recherche) et un modèle de génération (réponses). Options : OpenAI, Anthropic Claude, OpenRouter (multi-modèles), modèles locaux (Ollama).

## Décision

- **Embeddings** : OpenAI `text-embedding-3-small` (1536 dimensions).
- **Génération** : OpenAI `gpt-4o-mini`.

## Justification

- **Embeddings** : `text-embedding-3-small` est le standard RAG, excellent rapport qualité/prix, intégré nativement dans n8n (nœud OpenAI).
- **Génération** : `gpt-4o-mini` est rapide, économique et suffisant pour des réponses factuelles guidées par le contexte.
- **Un seul provider** : une seule credential n8n, un seul flux de facturation.

## Conséquences

- Une clé API OpenAI est requise (credential n8n « OpenAI »). Elle ne circule jamais dans les notes ni dans le repo (voir `docs/security.md`).
- Les contenus du vault sont envoyés à l'API OpenAI uniquement pour l'inférence (embedding/génération) — pas de stockage côté OpenAI.
- Alternative future (si souhaitée) : basculer la génération vers OpenRouter/Claude sans toucher à l'architecture — seul le nœud LLM change.