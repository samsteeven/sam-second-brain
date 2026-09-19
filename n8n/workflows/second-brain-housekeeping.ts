import { workflow, trigger, node, splitInBatches, nextBatch, newCredential, expr } from '@n8n/workflow-sdk';

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Hebdomadaire (dimanche 8h)',
    parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [0], triggerAtHour: 8, triggerAtMinute: 0 }] } },
  },
  output: [{}],
});

const httpTree = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'GitHub — Arbre du vault',
    parameters: {
      method: 'GET',
      url: 'https://api.github.com/repos/samsteeven/sam-second-brain-vault/git/trees/master?recursive=1',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      options: { response: { response: { neverError: true } } },
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{ tree: [{ path: '03-Projects/X.md', type: 'blob' }] }],
});

const codeFiles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtrer les notes .md',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const tree = $input.first().json.tree ?? [];\nconst files = tree.filter((n) => n.type === "blob" && n.path.endsWith(".md")).filter((n) => !n.path.startsWith(".obsidian") && !n.path.includes("/templates/") && !n.path.startsWith(".trash")).map((n) => n.path);\nreturn files.map((path) => ({ json: { path } }));',
    },
  },
  output: [{ path: '03-Projects/X.md' }],
});

const httpContent = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'GitHub — Contenu de la note',
    parameters: {
      method: 'GET',
      url: expr('https://api.github.com/repos/samsteeven/sam-second-brain-vault/contents/{{ $json.path }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{ path: '03-Projects/X.md', name: 'X.md', content: 'IyBY' }],
});

const codeDecode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Décoder + métadonnées',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const out = [];\nfor (const it of $input.all()) {\n  const content = Buffer.from(it.json.content, "base64").toString("utf8");\n  out.push({ json: { text: content, file: it.json.path } });\n}\nreturn out;',
    },
  },
  output: [{ text: '# X', file: '03-Projects/X.md' }],
});

const httpEmbed = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Ollama — Embed',
    parameters: {
      method: 'POST',
      url: 'http://ollama:11434/api/embed',
      authentication: 'none',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('={{ { model: "bge-m3", input: $json.text } }}'),
    },
  },
  output: [{ embeddings: [[0.1, 0.2]] }],
});

const httpSearch = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Qdrant — Search',
    parameters: {
      method: 'POST',
      url: 'http://qdrant:6333/collections/knowledge_base/points/search',
      authentication: 'none',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('={{ { vector: $json.embeddings[0], limit: 5, with_payload: true } }}'),
      options: { response: { response: { neverError: true } } },
    },
  },
  output: [{ result: [{ score: 0.9, payload: { metadata: { file: '03-Projects/Y.md' } } }] }],
});

const candidate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Candidat doublon',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const currentFile = $("Décoder + métadonnées").item.json.file;\n' +
        'const matches = ($json.result ?? [])\n' +
        '  .filter((r) => r.payload?.metadata?.file && r.payload.metadata.file !== currentFile)\n' +
        '  .filter((r) => typeof r.score === "number")\n' +
        '  .filter((r) => r.score > 0.7)\n' +
        '  .map((r) => ({ file: r.payload.metadata.file, score: Math.round(r.score * 100) }))\n' +
        '  .sort((a, b) => b.score - a.score);\n' +
        'return { json: { file: currentFile, matches } };',
    },
  },
  output: [{ file: '03-Projects/X.md', matches: [{ file: '03-Projects/Y.md', score: 83 }] }],
});

const report = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Construire le rapport',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const rows = $input.all().filter((r) => Array.isArray(r.json.matches) && r.json.matches.length);\n' +
        'const pairs = []; const seen = new Set();\n' +
        'for (const r of rows) {\n' +
        '  for (const m of r.json.matches) {\n' +
        '    const key = [r.json.file, m.file].sort().join("|");\n' +
        '    if (seen.has(key)) continue; seen.add(key);\n' +
        '    pairs.push({ a: r.json.file, b: m.file, score: m.score });\n' +
        '  }\n' +
        '}\n' +
        'pairs.sort((a, b) => b.score - a.score);\n' +
        'const date = new Date().toISOString().slice(0, 10);\n' +
        'let md = `---\\ntype: note\\nstatus: pending\\nimportance: low\\nsource: housekeeping\\ncreated: ${date}\\ntags: [housekeeping, doublons]\\n---\\n\\n# Rapport housekeeping\\n\\nPaires de notes potentiellement redondantes (similarité > 70 %) :\\n\\n`;\n' +
        'if (pairs.length === 0) md += "Aucune redondance détectée.\\n";\n' +
        'else pairs.forEach((p) => { md += `- \\`${p.a}\\` ↔ \\`${p.b}\\` (**${p.score} %**)\\n`; });\n' +
        'return [{ json: { path: `99-Capture/housekeeping-${date}.md`, contentBase64: Buffer.from(md, "utf8").toString("base64"), message: "Rapport housekeeping" } }];',
    },
  },
  output: [{ path: '99-Capture/housekeeping-2026-09-19.md', contentBase64: 'IyBSYXBwb3J0', message: 'Rapport' }],
});

const httpReport = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'GitHub — Écrire le rapport',
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
  output: [{ content: { path: '99-Capture/housekeeping-2026-09-19.md', sha: 'abc' } }],
});

const sib = splitInBatches({ version: 3, config: { name: 'Pour chaque note', parameters: { batchSize: 1 } } });

export default workflow('sam-second-brain-housekeeping', 'Second Brain — Housekeeping')
  .add(schedule)
  .to(httpTree)
  .to(codeFiles)
  .to(httpContent)
  .to(codeDecode)
  .to(sib
    .onDone(report.to(httpReport))
    .onEachBatch(httpEmbed.to(httpSearch).to(candidate).to(nextBatch(sib)))
  );