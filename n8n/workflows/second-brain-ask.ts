import { workflow, trigger, node, vectorStore, embedding, languageModel, newCredential, expr } from '@n8n/workflow-sdk';

const askWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook Question',
    parameters: {
      httpMethod: 'POST',
      path: 'second-brain/ask',
      responseMode: 'responseNode',
      authentication: 'headerAuth',
      options: { responseCode: { values: { responseCode: 200 } } },
    },
    credentials: { httpHeaderAuth: newCredential('Header Auth account') },
  },
  output: [{ body: { question: 'Quels sont mes projets Java Spring Boot ?' } }],
});

const normalize = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normaliser la question',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'question', name: 'question', value: expr('{{ $json.body?.question ?? $json.question ?? "" }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ question: 'Quels sont mes projets Java Spring Boot ?' }],
});

const embeddings = embedding({
  type: '@n8n/n8n-nodes-langchain.embeddingsOllama',
  version: 1,
  config: {
    name: 'Ollama Embeddings',
    parameters: { model: 'bge-m3' },
    credentials: { ollamaApi: newCredential('Ollama') },
  },
});

const qdrantSearch = vectorStore({
  type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant',
  version: 1.3,
  config: {
    name: 'Qdrant — Recherche',
    parameters: {
      mode: 'load',
      qdrantCollection: { __rl: true, mode: 'id', value: 'knowledge_base' },
      prompt: expr('{{ $json.question }}'),
      topK: 8,
      includeDocumentMetadata: true,
    },
    credentials: { qdrantApi: newCredential('Qdrant') },
    subnodes: { embedding: embeddings },
  },
  output: [{ pageContent: '## Mon projet\nContenu...', metadata: { file: '03-Projects/MonProjet.md', category: 'projects' } }],
});

const buildContext = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Contexte + Question',
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'context', name: 'context', value: expr('{{ $("Qdrant — Recherche").all().map((d, i) => "[" + (d.json.metadata?.file ?? "source") + "]\\n" + (d.json.pageContent ?? "")).join("\\n\\n---\\n\\n") }}'), type: 'string' },
          { id: 'question', name: 'question', value: expr('{{ $("Normaliser la question").item.json.question }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ context: '[03-Projects/MonProjet.md]\n## Mon projet\nContenu...', question: 'Quels sont mes projets Java Spring Boot ?' }],
});

const openRouterModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
  version: 1,
  config: {
    name: 'OpenRouter Chat Model',
    parameters: {
      model: 'openai/gpt-4.1-mini',
      options: { temperature: 0.2 },
    },
    credentials: { openRouterApi: newCredential('OpenRouter account') },
  },
});

const llm = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Réponse RAG',
    parameters: {
      promptType: 'define',
      text: expr('Tu es l\'assistant personnel de Sam. Réponds UNIQUEMENT à partir du CONTEXT fourni ci-dessous. Si l\'information n\'y est pas, dis-le clairement plutôt que d\'inventer. Cite les fichiers sources entre crochets, ex. [03-Projects/TribuneJustice.md].\n\nCONTEXT :\n{{ $json.context }}\n\nQUESTION : {{ $json.question }}'),
    },
    subnodes: { model: openRouterModel },
  },
  output: [{ output: 'D\'après tes notes, tu as développé EasyPharma en Spring Boot [03-Projects/EasyPharma.md].' }],
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Répondre au webhook',
    parameters: {
      respondWith: 'json',
      responseBody: expr('={{ { answer: $json.output, sources: $("Qdrant — Recherche").all().map(d => d.json.metadata?.file).filter(Boolean) } }}'),
    },
  },
  output: [{ answer: 'Réponse...', sources: ['03-Projects/EasyPharma.md'] }],
});

export default workflow('sam-second-brain-ask', 'Second Brain — Ask')
  .add(askWebhook)
  .to(normalize)
  .to(qdrantSearch)
  .to(buildContext)
  .to(llm)
  .to(respond);