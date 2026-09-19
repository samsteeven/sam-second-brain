# ADR-005 — Serveur MCP dédié (exposition scoped de la base de connaissances)

- **Statut** : Accepté (2026-09-19)
- **Décideur** : Samen Steeve

## Contexte

L'utilisateur veut brancher **n'importe quelle IA** (ChatGPT, Claude, Cursor, opencode…) à sa base de connaissances via le protocole MCP. L'option « Available in MCP » d'un workflow n8n (MCP instance-level) exposerait aussi les **outils d'administration n8n** (gestion des workflows, credentials…) — surface d'attaque trop large pour des données personnelles.

## Décision

Construire un **serveur MCP dédié** qui n'expose **que** les outils du second cerveau :

```
MCP Server Trigger (mcpTrigger, path: second-brain-kb, bearer auth)
  ├─ second_brain_ask  → sous-workflow KB Query (RAG : Ollama → Qdrant → OpenCode Go)
  └─ second_brain_add  → sous-workflow Add Note (écriture quarantaine → GitHub)
```

- URL production : `https://n8n.samensteeve.com/mcp/second-brain-kb`
- Auth : `Bearer <token>` (credential « MCP Second Brain »)
- Les sous-workflows sont en **passthrough** (l'argument MCP arrive sous la clé `query`/`input` — observé empiriquement sur cette version de n8n).

## Justification

- **Périmètre réduit au strict nécessaire** : lecture + écriture contrôlée, jamais l'admin n8n.
- **Auth bearer dédiée** : token séparé, révocable (changer la credential).
- **Séparations des responsabilités** : le serveur MCP (mcpTrigger) délègue à des sous-workflows réutilisables (KB Query, Add Note).

## Conséquences

- Un client MCP ne voit que `second_brain_ask` et `second_brain_add`.
- Le token ne doit pas être partagé (accès aux notes personnelles).
- Toute nouvelle capacité (ex. mise à jour de note) = nouvelle sous-workflow + outil ajouté aux `subnodes.tools` du trigger.