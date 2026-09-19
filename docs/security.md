# Sécurité

## Principes

1. **Le vault personnel n'est jamais sur un repo public.** Il vit sur le repo **privé** `samsteeven/sam-second-brain-vault` (sync automatique vers Qdrant via n8n). Le repo public `sam-second-brain` ne contient que du code, des templates et de la documentation — **aucune note personnelle**.
2. **Les secrets ne vont ni dans le repo, ni dans le vault.** La clé OpenRouter, le token GitHub et la credential Qdrant vivent exclusivement dans les credentials n8n.
3. **Aucune donnée personnelle n'est envoyée ailleurs que nécessaire** : l'indexation (embeddings) se fait **en local sur le VPS via Ollama** — les notes ne quittent pas le serveur. Seul le **contexte des questions** part vers OpenRouter pour la génération. Le token GitHub ne donne accès qu'au repo privé du vault (Contents: Read uniquement).

## Cartographie des données

| Donnée | Où elle vit | Risque |
|---|---|---|
| Note personnelle (vault) | Local + **repo GitHub privé** `sam-second-brain-vault` | Confidentialité — jamais de repo public |
| Embeddings + textes chunkés | Qdrant (VPS) | Faible (VPS privé) |
| Clé API OpenRouter | Credential n8n | Critique — ne jamais la mettre en clair |
| Token GitHub | Credential n8n (Bearer) | Critique — scope limité au repo du vault |
| Question / réponses | Transit via n8n → OpenRouter | Les questions peuvent contenir des infos perso — à garder en tête |

## Règles concrètes

- `.gitignore` exclut tout fichier `*.env`, les dumps, et le vault local (`sam-second-brain-vault/`).
- **Le push du vault se fait UNIQUEMENT sur le repo privé** `sam-second-brain-vault`.
- Credentials n8n : utiliser les credentials n8n (stockées chiffrées), jamais de valeurs en dur dans les paramètres de nœuds.
- Token GitHub : fine-grained, accès **`sam-second-brain-vault`** en **Contents: Read AND write** (l'écriture est nécessaire pour l'outil MCP `second_brain_add`), jamais d'autres repos.
- L'outil MCP `second_brain_add` écrit uniquement dans `99-Capture/` du vault — toute note ajoutée par une IA passe par le versioning Git (annulable).
- Webhook de question : authentifié par header (credential « Header Auth account »).
- La ré-indexation vide la collection Qdrant à chaque run → pas d'accumulation de données obsolètes.

## Checklist avant publication (poste LinkedIn / démo)

- [ ] Vérifier qu'aucun fichier du vault n'est tracké dans le repo public
- [ ] Vérifier qu'aucune clé API n'apparaît dans l'historique git
- [ ] Utiliser des données fictives pour toute capture d'écran publique