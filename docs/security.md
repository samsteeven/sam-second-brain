# Sécurité

## Principes

1. **Le vault personnel n'est jamais publié.** Le repo public `sam-second-brain` ne contient que du code, des templates et de la documentation — **aucune note personnelle**.
2. **Les secrets ne vont ni dans le repo, ni dans le vault.** La clé OpenAI vit exclusivement dans la credential n8n.
3. **Aucune donnée personnelle n'est envoyée ailleurs que nécessaire** : les contenus partent vers l'API OpenAI pour l'inférence (embedding / génération) et vers Qdrant local — rien n'est stocké par des tiers.

## Cartographie des données

| Donnée | Où elle vit | Risque |
|---|---|---|
| Notes personnelles (vault) | Local `sam-second-brain-vault/` | Confidentialité — ne pas push sur un repo public |
| Embeddings + textes chunkés | Qdrant local (Docker) | Faible (local) |
| Clé API OpenAI | Credential n8n | Critique — ne jamais la mettre en clair |
| Question / réponses | Transit via n8n → OpenAI | Les questions peuvent contenir des infos perso — à garder en tête |

## Règles concrètes

- `.gitignore` exclut tout fichier `*.env`, les dumps, et le vault local (`sam-second-brain-vault/`).
- Si un push du vault est souhaité : **repo privé** uniquement.
- Credentials n8n : utiliser les credentials n8n (stockées chiffrées), jamais de valeurs en dur dans les paramètres de nœuds.
- Webhook de question : si exposé publiquement, ajouter un header d'authentification (ex. `X-API-Key`) — voir workflow Ask.
- Nettoyer régulièrement les points Qdrant des fichiers supprimés (réindexation complète si besoin).

## Checklist avant publication (poste LinkedIn / démo)

- [ ] Vérifier qu'aucun fichier du vault n'est tracké dans le repo public
- [ ] Vérifier qu'aucune clé API n'apparaît dans l'historique git
- [ ] Utiliser des données fictives pour toute capture d'écran publique