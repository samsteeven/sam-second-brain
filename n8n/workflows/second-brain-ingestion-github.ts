import { workflow, trigger, node, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Toutes les 30 min', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } } },
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
  output: [{ tree: [{ path: '01-Identity/About-Me.md', type: 'blob' }] }],
});

const codeFiles = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtrer les notes .md',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const tree = $input.first().json.tree ?? [];\n' +
        'const files = tree\n' +
        '  .filter((n) => n.type === "blob" && n.path.endsWith(".md"))\n' +
        '  .filter((n) => !n.path.startsWith(".obsidian") && !n.path.includes("/templates/") && !n.path.startsWith(".trash") && !n.path.startsWith("99-Capture/"))\n' +
        '  .map((n) => n.path);\n' +
        'return files.map((path) => ({ json: { path } }));',
    },
  },
  output: [{ path: '01-Identity/About-Me.md' }],
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
  output: [{ path: '01-Identity/About-Me.md', name: 'About-Me.md', content: 'IyBBYm91dCBNZQo=' }],
});

const codeDecode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Décoder + métadonnées',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const out = [];\n' +
        'for (const it of $input.all()) {\n' +
        '  const content = Buffer.from(it.json.content, "base64").toString("utf8");\n' +
        '  let category = "knowledge"; let tags = ""; let status = "";\n' +
        '  const m = content.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---/);\n' +
        '  if (m) {\n' +
        '    const fm = m[1];\n' +
        '    const t = fm.match(/^type:\\s*([\\w-]+)/m); if (t) category = t[1];\n' +
        '    const ta = fm.match(/^tags:\\s*\\[(.*?)\\]/m); if (ta) tags = ta[1];\n' +
        '    const s = fm.match(/^status:\\s*([\\w-]+)/m); if (s) status = s[1];\n' +
        '  }\n' +
        '  if (status === "pending") continue;\n' +
        '  out.push({ json: { text: content, file: it.json.path, category, tags, status } });\n' +
        '}\n' +
        'return out;',
    },
  },
  output: [{ text: '# About Me', file: '01-Identity/About-Me.md', category: 'identity', tags: 'profil', status: 'active' }],
});

// 1 chunk = 1 titre + son contenu, préfixé par `[fichier] Titre > Sous-titre`.
// Découpage sur les paragraphes puis les lignes : jamais au milieu d'un mot.
const CHUNKER_CODE = String.raw`const CHUNK = 900;

function hash(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function hex8(n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }
function makeId(s) {
  const h = hex8(hash(s, 2166136261)) + hex8(hash(s, 1099511628211)) + hex8(hash(s + '#b', 2246822519)) + hex8(hash(s + '#c', 3266489917));
  return h.slice(0,8) + '-' + h.slice(8,12) + '-' + h.slice(12,16) + '-' + h.slice(16,20) + '-' + h.slice(20,32);
}

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let heading = null;
  let body = [];
  const flush = () => {
    const b = body.join('\n').trim();
    if (heading || b) sections.push({ heading, body: b });
  };
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) { flush(); heading = { level: m[1].length, title: m[2] }; body = []; }
    else body.push(line);
  }
  flush();
  return sections;
}

function packBlocks(body, limit) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  const push = () => { if (buf) { out.push(buf); buf = ''; } };
  for (const block of blocks) {
    if (block.length > limit) {
      push();
      let lb = '';
      for (const line of block.split('\n')) {
        if (lb && lb.length + 1 + line.length > limit) { out.push(lb); lb = line; }
        else { lb = lb ? lb + '\n' + line : line; }
      }
      if (lb) out.push(lb);
    } else if (buf && buf.length + 2 + block.length > limit) {
      push();
      buf = block;
    } else {
      buf = buf ? buf + '\n\n' + block : block;
    }
  }
  push();
  return out.length ? out : [body];
}

const out = [];
for (const item of $input.all()) {
  const j = item.json;
  if (!j || typeof j.text !== 'string') continue;
  const file = j.file || 'unknown';
  const sections = splitSections(stripFrontmatter(j.text));
  const stack = [];
  for (const sec of sections) {
    if (sec.heading) {
      while (stack.length && stack[stack.length - 1].level >= sec.heading.level) stack.pop();
      stack.push(sec.heading);
    }
    if (!sec.body) continue;
    const path = stack.map((h) => h.title).join(' > ');
    const prefix = path ? '[' + file + '] ' + path : '[' + file + ']';
    for (const part of packBlocks(sec.body, CHUNK)) {
      const text = prefix + '\n' + part;
      out.push({ id: makeId(file + '::' + text), text, file, category: j.category || 'knowledge', tags: j.tags || '' });
    }
  }
}
return [{ json: { texts: out.map((c) => c.text), chunks: out } }];`;

const codeChunk = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Chunker + IDs',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: CHUNKER_CODE },
  },
  output: [{ texts: ['[03-Projects/TribuneJustice.md] TribuneJustice > Rôle\nTech Lead — ...'], chunks: [{ id: '05d62998-92d4-7452-1853-ca0f029943ae', text: '...', file: '03-Projects/TribuneJustice.md' }] }],
});

const httpExistingIds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Qdrant — IDs existants',
    parameters: {
      method: 'POST',
      url: 'http://qdrant:6333/collections/knowledge_base/points',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ ids: $json.chunks.map((c) => c.id), with_payload: false, with_vector: false }) }}'),
      options: { timeout: 120000 },
    },
  },
  output: [{ result: [{ id: '05d62998-92d4-7452-1853-ca0f029943ae' }] }],
});

const codeToEmbed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Filtrer à embedder',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const chunks = $(\'Chunker + IDs\').first().json.chunks;\n' +
        'const existing = new Set(($json.result || []).map((p) => p.id));\n' +
        'const toEmbed = chunks.filter((c) => !existing.has(c.id));\n' +
        'const runStart = Date.parse($(\'Toutes les 30 min\').first().json.timestamp) || 0;\n' +
        'return [{ json: { texts: toEmbed.map((c) => c.text), chunks: toEmbed, allIds: chunks.map((c) => c.id), runStart, total: chunks.length, toEmbedCount: toEmbed.length } }];',
    },
  },
  output: [{ texts: ['[03-Projects/TribuneJustice.md] TribuneJustice > Rôle\nTech Lead — ...'], chunks: [], allIds: [], runStart: 1789877894187, total: 418, toEmbedCount: 3 }],
});

const gate = ifElse({
  version: 2.2,
  config: {
    name: 'Rien à embedder ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr('{{ $json.chunks.length }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 },
        ],
        combinator: 'and',
      },
    },
  },
});

const httpEmbed = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Ollama — Embeddings',
    parameters: {
      method: 'POST',
      url: 'http://ollama:11434/api/embed',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ model: 'bge-m3', input: $json.texts }) }}"),
      options: { timeout: 1800000 },
    },
  },
  output: [{ embeddings: [[0.021, -0.113]] }],
});

const codePoints = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Construire les points',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const chunks = $(\'Filtrer à embedder\').first().json.chunks;\n' +
        'const embs = $input.first().json.embeddings || [];\n' +
        'const indexedAt = Date.now();\n' +
        'const points = chunks.map((c, i) => ({ id: c.id, vector: embs[i], payload: { content: c.text, metadata: { file: c.file, category: c.category, tags: c.tags }, indexed_at: indexedAt } }));\n' +
        'return [{ json: { points, count: points.length } }];',
    },
  },
  output: [{ points: [{ id: '05d62998-92d4-7452-1853-ca0f029943ae', vector: [0.021], payload: { content: '...', indexed_at: 1789877894187 } }], count: 3 }],
});

const httpUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Qdrant — Upsert',
    parameters: {
      method: 'PUT',
      url: 'http://qdrant:6333/collections/knowledge_base/points?wait=true',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ points: $json.points }) }}'),
      options: { timeout: 300000 },
    },
  },
  output: [{ status: 'ok' }],
});

const httpCleanup = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Qdrant — Nettoyage orphelins',
    parameters: {
      method: 'POST',
      url: 'http://qdrant:6333/collections/knowledge_base/points/delete?wait=true',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ filter: { must: [ { key: 'indexed_at', range: { lt: $('Filtrer à embedder').first().json.runStart } } ], must_not: [ { has_id: $('Filtrer à embedder').first().json.allIds } ] } }) }}"),
      options: { response: { response: { neverError: true } }, timeout: 120000 },
    },
  },
  output: [{ status: 'ok' }],
});

export default workflow('sam-second-brain-ingestion-github', 'Second Brain — Ingestion (GitHub)')
  .add(schedule)
  .to(httpTree)
  .to(codeFiles)
  .to(httpContent)
  .to(codeDecode)
  .to(codeChunk)
  .to(httpExistingIds)
  .to(codeToEmbed)
  .to(gate
    .onTrue(httpEmbed.to(codePoints.to(httpUpsert.to(httpCleanup))))
    .onFalse(httpCleanup));
