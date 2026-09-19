# ADR-004 — Génération via la passerelle OpenCode Go (DeepSeek V4 Flash Vision)

- **Statut** : Accepté (2026-09-19)
- **Décideur** : Samen Steeve
- **Remplace** : la partie « génération » d'ADR-002 et d'ADR-003

## Contexte

ADR-002 puis ADR-003 prévoyaient la génération via OpenAI puis OpenRouter. Aucun de ces fournisseurs n'est utilisable : pas de clé OpenAI, pas de fonds sur le compte Zen. L'utilisateur dispose en revanche de la passerelle **OpenCode Go** (celle qui alimente l'assistant opencode), avec des clés API existantes.

## Décision

- **Passerelle** : `https://opencode.ai/zen/go/v1` (API compatible OpenAI, `chat/completions`).
- **Modèle** : `deepseek-v4-flash-vision-exp` (id **sans** préfixe — sur cette passerelle, les modèles ne portent pas `deepseek/`).
- **Header requis** : `x-opencode-session: <session>` (obligatoire, sinon 400).
- **Appel** : nœud HTTP Request direct (le nœud de modèle OpenAI de n8n n'expose pas le header custom `x-opencode-session`).

## Justification

- **Zéro coût additionnel** : réutilise les clés opencode existantes.
- **Modèle vision** : `deepseek-v4-flash-vision-exp` est le modèle qui alimente l'assistant opencode — éprouvé, coût faible.
- **Contrôle total** : le HTTP direct permet d'ajouter le header `x-opencode-session` et de piloter le payload (system + context).

## Conséquences

- L'URL et le header sont spécifiques à cette passerelle (renseignés dans le nœud « OpenCode Go — Chat » des workflows Ask et KB Query).
- Changer de fournisseur = remplacer le nœud HTTP (aucun impact ailleurs).
- Le `x-opencode-session` est fixé à `second-brain` (une valeur stable suffit pour le routage).