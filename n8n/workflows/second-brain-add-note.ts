import { workflow, trigger, node, vectorStore, embedding, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const subTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Entrée (note)', parameters: { inputSource: 'passthrough' } },
  output: [{ input: 'Contenu de la note en markdown', title: 'Titre optionnel' }],
});

const prep = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Préparer le contenu',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const v = $json;\n' +
        'const raw = (typeof v === "string" ? v : (v.input ?? v.query ?? v.content ?? v.note ?? v.question ?? "")).trim();\n' +
        'if (!raw) return { json: { error: "Note vide", received: Object.keys(v ?? {}) } };\n' +
        'const firstHeading = raw.match(/^#\\s+(.+)$/m)?.[1]?.trim();\n' +
        'const firstLine = raw.split("\\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));\n' +
        'const title = ($json.title ?? "").trim() || firstHeading || (firstLine ? firstLine.slice(0, 60) : "Note");\n' +
        'const slug = title.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "note";\n' +
        'const date = new Date().toISOString().slice(0, 10);\n' +
        'return { json: { raw, title, slug, date } };',
    },
  },
  output: [{ raw: '# Titre\nContenu', title: 'Titre', slug: 'titre', date: '2026-09-19' }],
});

const classify = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'OpenCode Go — Classifier',
    parameters: {
      method: 'POST',
      url: 'https://opencode.ai/zen/go/v1/chat/completions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'x-opencode-session', value: 'second-brain' },
        ],
      },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("={{ { model: \"deepseek-v4-flash-vision-exp\", temperature: 0, messages: [ { role: \"system\", content: \"Tu classes des notes pour une base de connaissances. Réponds UNIQUEMENT avec un objet JSON : { \\\"type\\\": \\\"knowledge|identity|career|project|study|skill|note|meeting|idea|decision\\\", \\\"tags\\\": [\\\"mot-clé\\\", ...], \\\"folder\\\": \\\"chemin du dossier cible dans le vault (ex: 06-Knowledge/Cloud, 03-Projects, 05-Skills)\\\" }. Aucun autre texte.\" }, { role: \"user\", content: $json.raw } ] } }}"),
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account 2') },
  },
  output: [{ choices: [{ message: { content: '{"type":"knowledge","tags":["cloud"],"folder":"06-Knowledge/Cloud"}' } }] }],
});

const parseClass = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parser la classification',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const text = $json.choices?.[0]?.message?.content ?? "{}";\n' +
        'let c = {};\n' +
        'const m = text.match(/{[\\s\\S]*}/);\n' +
        'if (m) { try { c = JSON.parse(m[0]); } catch { c = {}; } }\n' +
        'const type = (c.type ?? "note").toString().toLowerCase();\n' +
        'const tags = Array.isArray(c.tags) ? c.tags.slice(0, 6).map((t) => String(t).replace(/[^\\w-]/g, "").toLowerCase()).filter(Boolean) : [];\n' +
        'const folder = (c.folder ?? "06-Knowledge").toString().replace(/[\\r\\n]+/g, "").replace(/\\/+/g, "/").replace(/^\\/+|\\/+$/g, "") || "06-Knowledge";\n' +
        'return { json: { type, tags, folder } };',
    },
  },
  output: [{ type: 'knowledge', tags: ['cloud'], folder: '06-Knowledge/Cloud' }],
});

const embeddings = embedding({
  type: '@n8n/n8n-nodes-langchain.embeddingsOllama',
  version: 1,
  config: { name: 'Ollama Embeddings', parameters: { model: 'bge-m3' }, credentials: { ollamaApi: newCredential('Ollama account') } },
});

const dedupSearch = vectorStore({
  type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant',
  version: 1.3,
  config: {
    name: 'Qdrant — Dédoublonnage',
    parameters: {
      mode: 'load',
      qdrantCollection: { __rl: true, mode: 'id', value: 'knowledge_base' },
      prompt: expr('{{ $("Préparer le contenu").item.json.raw }}'),
      topK: 3,
      includeDocumentMetadata: true,
    },
    credentials: { qdrantApi: newCredential('Qdrant account') },
    subnodes: { embedding: embeddings },
  },
  output: [{ document: { pageContent: '...', metadata: { file: '03-Projects/X.md' } }, score: 0.9 }],
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Décider doublon + construire',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const matches = $("Qdrant — Dédoublonnage").all()\n' +
        '  .map((d) => ({ file: d.json.document?.metadata?.file ?? null, score: d.json.score }))\n' +
        '  .filter((m) => typeof m.score === "number" && m.file)\n' +
        '  .sort((a, b) => b.score - a.score);\n' +
        'const best = matches[0];\n' +
        'const prep = $("Préparer le contenu").first().json;\n' +
        'const cls = $("Parser la classification").first().json;\n' +
        'if (best && best.score >= 0.75) {\n' +
        '  return { json: { action: "skip", existing: best.file, similarity: best.score } };\n' +
        '}\n' +
        'const dedupeWarning = best && best.score >= 0.55 ? `Note similaire détectée : ${best.file} (${Math.round(best.score * 100)}%)` : null;\n' +
        'const type = cls.type || "note";\n' +
        'const tags = (Array.isArray(cls.tags) && cls.tags.length ? cls.tags : ["ia", "capture"]).join(", ");\n' +
        'const folder = (cls.folder || "06-Knowledge").replace(/^\\/+|\\/+$/g, "");\n' +
        'const body = `---\\ntype: ${type}\\nstatus: pending\\nimportance: medium\\nsource: ia\\ncreated: ${prep.date}\\ntags: [${tags}]\\n---\\n\\n# ${prep.title}\\n\\n${prep.raw}`;\n' +
        'const path = `${folder}/${prep.date}-${prep.slug}.md`;\n' +
        'return { json: { action: "write", path, contentBase64: Buffer.from(body, "utf8").toString("base64"), message: `Note IA classée (${type}) en attente de validation`, dedupeWarning } };',
    },
  },
  output: [{ action: 'write', path: '06-Knowledge/Cloud/2026-09-19-x.md', contentBase64: 'IyB4', message: 'Note classée' }],
});

const write = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'GitHub — Créer la note',
    parameters: {
      method: 'PUT',
      url: expr('https://api.github.com/repos/samsteeven/sam-second-brain-vault/contents/{{ $json.path }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('={{ { message: $json.message, content: $json.contentBase64, branch: "master" } }}'),
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{ content: { path: '06-Knowledge/Cloud/2026-09-19-x.md', sha: 'abc' }, commit: { sha: 'def' } }],
});

const formatOk = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Formater succès',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const warn = $("Décider doublon + construire").first().json.dedupeWarning ?? null;\nreturn { json: { response: { ok: true, path: $json.content?.path ?? null, warning: warn } } };',
    },
  },
  output: [{ response: { ok: true, path: '06-Knowledge/Cloud/2026-09-19-x.md', warning: null } }],
});

const formatSkip = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Formater doublon',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'return { json: { response: { ok: false, warning: "Note non ajoutée : trop similaire à une note existante", existing: $json.existing, similarity: $json.similarity } } };',
    },
  },
  output: [{ response: { ok: false, warning: 'Doublon', existing: '03-Projects/X.md', similarity: 0.9 } }],
});

const dupCheck = ifElse({
  version: 2.2,
  config: {
    name: 'Doublon ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'write' }],
        combinator: 'and',
      },
    },
  },
});

export default workflow('sam-second-brain-add-note', 'Second Brain — Add Note')
  .add(subTrigger)
  .to(prep)
  .to(classify)
  .to(parseClass)
  .to(dedupSearch)
  .to(decide)
  .to(dupCheck
    .onTrue(write.to(formatOk))
    .onFalse(formatSkip)
  );