# AGENTS.md — Règles de cohérence du projet

> **Ce fichier est la loi du projet.** Toute IA (opencode, Cursor, Claude, ChatGPT…) — et tout humain — qui touche au code, à la documentation, aux workflows n8n ou au vault doit le lire et le respecter.
>
> **Objectif : empêcher la dérive.** Ce projet est un système vivant (code + docs + workflows + vault) : une seule référence obsolète et tout devient un bordel. La cohérence n'est pas optionnelle.

---

## 0. Les 5 règles d'or

1. **Une source de vérité unique.** Une information ne vit qu'à un endroit ; partout ailleurs, elle est *référencée*, jamais recopiée. Si tu recopies, tu dois mettre à jour **toutes** les copies.
2. **Zéro incohérence tolérée.** Après **chaque** changement, cherche activement les endroits devenus faux (grep) et corrige-les dans le même commit.
3. **Jamais de fait inventé.** Pas de chiffre, de date, de nom de credential, d'ID ou de version qui ne soit pas vérifié dans le code, la doc, la base n8n ou le repo. Dans le doute : vérifier, ou écrire « à vérifier ».
4. **Jamais de secret** dans le repo ou le vault. Clés, tokens et credentials vivent **exclusivement** dans les credentials n8n (chiffrées).
5. **L'historique ne se réécrit pas.** Un ADR remplacé reste, annoté `SUPERSÉDÉ par ADR-XXX`. On ne supprime pas une décision passée, on la marque.

---

## 1. Avant de changer quoi que ce soit

- Lire `README.md`, `docs/architecture.md`, `docs/security.md` et l'ADR concerné.
- Vérifier l'état réel **dans la source** (code, base n8n, repo) — pas seulement dans la doc, qui peut être périmée.
- Se demander : **« quels autres fichiers décrivent ce que je viens de changer ? »**

## 2. Quand tu changes un composant, mets à jour TOUT ce qui le décrit

| Ce que tu changes | Où il faut répercuter |
|---|---|
| Un workflow n8n (nom, ID, nœud, credential) | `n8n/workflows/README.md`, `docs/architecture.md`, `README.md`, note vault `03-Projects/Second-Brain.md` |
| Le LLM / fournisseur / modèle | `README.md` (tableau Stack), `docs/architecture.md`, `docs/security.md`, ADR dédié |
| Un outil MCP (ajout/retrait/renommage) | `docs/architecture.md`, `docs/decisions/ADR-005-*.md`, `n8n/workflows/README.md`, `README.md`, vault (`MCP.md`, `Second-Brain.md`, `Securite-IA.md`) |
| Un token / scope / credential | `docs/security.md`, `n8n/workflows/README.md` (matrice des credentials), `README.md` |
| Une décision structurante | **Créer un ADR** dans `docs/decisions/` + le lister dans `README.md` |
| Une note du vault | Le frontmatter, et les liens `[[…]]` |

## 3. Conventions de nommage (pour ne plus jamais induire en erreur)

- **Nœud n8n** : nommer par ce que le nœud **fait réellement**, jamais par une marque qu'il n'utilise pas. *(Contre-exemple historique : un nœud nommé « OpenRouter Model » qui pointait en fait vers OpenCode Go — corrigé.)*
- **Credential n8n** : le nom doit décrire la **destination**, pas le type. *(Contre-exemple : « OpenAI account » dont la base URL est `https://opencode.ai/zen/go/v1`.)*
- **Workflow n8n** : `Second Brain — <Rôle>`.
- **Note du vault** : PascalCase à tirets (`Design-for-Failure.md`), un sujet par note.
- **Fichier de code/docs** : respecter le style existant du dossier.

## 4. Le vault (données personnelles)

- Le vault vit sur le repo **privé** `samsteeven/sam-second-brain-vault` — **jamais** dans ce repo public.
- Chaque note a un **frontmatter YAML** (`type`, `status`, `importance`, `tags`).
- **Une note = un sujet.** Lier avec `[[…]]`.
- **Écriture par IA = quarantaine** : `status: pending` dans `99-Capture/`, jamais indexée sans validation humaine (ADR-006). Ne jamais écrire une note IA directement en `active`.
- Ne pas créer de fichiers parasites (canvas vides, brouillons) : Obsidian en génère parfois — les supprimer.

## 5. Sécurité

- Les écritures passent **uniquement** par la credential fine-grained limitée au vault ; la lecture multi-repos par la credential classic `Github Read`, **jamais** en écriture (voir la matrice dans `n8n/workflows/README.md`).
- Ne jamais exposer un token dans un log, un commit, une capture ou une réponse.

## 6. Definition of Done (checklist obligatoire)

Avant de considérer une tâche terminée :

- [ ] Le changement est vérifié **dans la source** (pas seulement supposé).
- [ ] `grep` des termes obsolètes effectué sur **le repo ET le vault** (ex. ancien nom de modèle, ancien ID, ancien nombre d'outils/workflows).
- [ ] Tous les fichiers listés en §2 sont à jour.
- [ ] Aucun secret ajouté.
- [ ] Si décision structurante : ADR créé/annoté.
- [ ] Commit au message clair ; vault poussé sur le repo privé si modifié.

## 7. Langue

Le projet est documenté en **français**. Garder le ton factuel, sans emphase ni chiffres non vérifiés.

## 8. Pièges connus (vérifiés)

- **Ingestion concurrente** : le workflow Ingestion « vide puis ré-indexe » → **deux exécutions simultanées dupliquent la base** (observé). Ne jamais lancer un run manuel si un run est déjà en cours. Correctif de fond : IDs de points déterministes (upsert idempotent).
- **Noms trompeurs** : ne jamais nommer un composant d'après une marque qu'il n'utilise pas (voir §3).
- **Workflows en double/archivés** : l'instance n8n contient des doublons archivés — **toujours vérifier `active`/`isArchived`** avant de considérer un workflow comme actif.
