import { workflow, trigger, node, vectorStore, embedding, documentLoader, textSplitter, splitInBatches, nextBatch, newCredential, expr } from '@n8n/workflow-sdk';

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Toutes les 30 min',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } },
  },
  output: [{}],
});

const httpClear = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Qdrant — Vider la collection',
    executeOnce: true,
    parameters: {
      method: 'POST',
      url: 'http://qdrant:6333/collections/knowledge_base/points/delete',
      authentication: 'none',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: { filter: { must: [] } },
      options: { response: { response: { neverError: true } } },
    },
  },
  output: [{ status: 'ok' }],
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
    credentials: { httpBearerAuth: newCredential('GitHub token') },
  },
  output: [{ tree: [{ path: '01-Identity/About-Me.md', type: 'blob' }, { path: '03-Projects/EasyPharma.md', type: 'blob' }] }],
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
        '  .filter((n) => !n.path.startsWith(".obsidian") && !n.path.includes("/templates/") && !n.path.startsWith(".trash"))\n' +
        '  .map((n) => n.path);\n' +
        'return files.map((path) => ({ json: { path } }));',
    },
  },
  output: [{ path: '01-Identity/About-Me.md' }, { path: '03-Projects/EasyPharma.md' }],
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
    credentials: { httpBearerAuth: newCredential('GitHub token') },
  },
  output: [{ path: '01-Identity/About-Me.md', name: 'About-Me.md', content: 'IyBBYm91dCBNZQo=' }],
});

const codeDecode = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Décoder + métadonnées',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const content = Buffer.from($json.content, "base64").toString("utf8");\n' +
        'let category = "knowledge"; let tags = ""; let status = "";\n' +
        'const m = content.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---/);\n' +
        'if (m) {\n' +
        '  const fm = m[1];\n' +
        '  const t = fm.match(/^type:\\s*([\\w-]+)/m); if (t) category = t[1];\n' +
        '  const ta = fm.match(/^tags:\\s*\\[(.*?)\\]/m); if (ta) tags = ta[1];\n' +
        '  const s = fm.match(/^status:\\s*([\\w-]+)/m); if (s) status = s[1];\n' +
        '}\n' +
        'return { json: { text: content, file: $json.path, category, tags, status } };',
    },
  },
  output: [{ text: '# About Me', file: '01-Identity/About-Me.md', category: 'identity', tags: 'profil', status: 'active' }],
});

const splitter = textSplitter({
  type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter',
  version: 1,
  config: {
    name: 'Splitter Markdown',
    parameters: { chunkSize: 800, chunkOverlap: 100, options: { splitCode: 'markdown' } },
  },
});

const loader = documentLoader({
  type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader',
  version: 1.1,
  config: {
    name: 'Charger les notes',
    parameters: { dataType: 'json', jsonMode: 'allInputData', textSplittingMode: 'custom' },
    subnodes: { textSplitter: splitter },
  },
});

const embeddings = embedding({
  type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  version: 1,
  config: {
    name: 'OpenAI Embeddings',
    parameters: { model: 'text-embedding-3-small' },
    credentials: { openAiApi: newCredential('OpenAI account') },
  },
});

const qdrantStore = vectorStore({
  type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant',
  version: 1.3,
  config: {
    name: 'Qdrant — Indexer',
    parameters: { mode: 'insert', qdrantCollection: { __rl: true, mode: 'id', value: 'knowledge_base' } },
    credentials: { qdrantApi: newCredential('Qdrant') },
    subnodes: { embedding: embeddings, documentLoader: loader },
  },
});

const sib = splitInBatches({ version: 3, config: { name: 'Pour chaque note', parameters: { batchSize: 1 } } });

export default workflow('sam-second-brain-ingestion-github', 'Second Brain — Ingestion (GitHub)')
  .add(schedule)
  .to(httpClear)
  .to(httpTree)
  .to(codeFiles)
  .to(sib
    .onDone(qdrantStore)
    .onEachBatch(httpContent.to(codeDecode).to(nextBatch(sib)))
  );