import { workflow, trigger, node, vectorStore, embedding, documentLoader, textSplitter, newCredential, expr } from '@n8n/workflow-sdk';

const ingestWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook Ingestion',
    parameters: {
      httpMethod: 'POST',
      path: 'second-brain/ingest',
      responseMode: 'onReceived',
      options: { noResponseBody: true },
    },
  },
  output: [{ body: { text: '## Mon projet\nContenu de la note...', file: '03-Projects/MonProjet.md', category: 'projects', tags: 'laravel, angular' } }],
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
    name: 'Charger les notes entrantes',
    parameters: {
      dataType: 'json',
      jsonMode: 'allInputData',
      textSplittingMode: 'custom',
    },
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
    parameters: {
      mode: 'insert',
      qdrantCollection: { __rl: true, mode: 'id', value: 'knowledge_base' },
    },
    credentials: { qdrantApi: newCredential('Qdrant') },
    subnodes: { embedding: embeddings, documentLoader: loader },
  },
});

export default workflow('sam-second-brain-ingestion', 'Second Brain — Ingestion')
  .add(ingestWebhook)
  .to(qdrantStore);