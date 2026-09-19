# ADR-003 — Embeddings locaux avec Ollama (bge-m3)

- **Statut** : Accepté (2026-09-19)
- **Décideur** : Samen Steeve
- **Remplace partiellement** : ADR-002 (pour la partie embeddings)

## Contexte

ADR-002 prévoyait les embeddings via OpenAI `text-embedding-3-small`. Or je n'ai pas de clé API OpenAI, et je veux éviter une dépendance payante et l'envoi de notes personnelles à un service tiers pour l'indexation.

## Décision

- **Embeddings** : **Ollama** auto-hébergé (conteneur Docker sur le VPS), modèle **`bge-m3`** (1024 dimensions, multilingue — bon en français).
- **Génération** : **OpenRouter** (`openai/gpt-4.1-mini`), via la credential OpenRouter existante (remplace OpenAI GPT pour le chat).

## Justification

- **Aucun coût d'API** pour l'indexation ; pas besoin de clé OpenAI.
- **Confidentialité renforcée** : les notes ne quittent pas le VPS pour l'embedding (seul le contexte des questions part vers OpenRouter pour la génération).
- **bge-m3** : excellent en multilingue (le vault est en français), 1024 dims, contexte 8k.
- Ollama s'intègre nativement dans n8n (`Embeddings Ollama`).

## Conséquences

- **Ollama doit tourner** sur le VPS, sur le réseau Docker de n8n (`http://ollama:11434`), avec le modèle `bge-m3` téléchargé.
- La dimension de la collection Qdrant est **1024** (fixée à la création par le premier insert). Ne pas mélanger avec un autre modèle d'embeddings sans ré-indexer.
- Un **swap de 2 Go** a été ajouté au VPS pour absorber le chargement du modèle (RAM limitée).
- OpenRouter reste nécessaire pour la génération (l'utilisateur possède déjà la credential).

## Déploiement (VPS)

```bash
docker run -d --name ollama --network n8n_n8n --restart unless-stopped \
  -v ollama_data:/root/.ollama -p 127.0.0.1:11434:11434 ollama/ollama
docker exec ollama ollama pull bge-m3
```

Credential n8n : type **Ollama**, base URL `http://ollama:11434`.