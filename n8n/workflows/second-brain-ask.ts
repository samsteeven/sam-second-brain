import { workflow, trigger, node, vectorStore, embedding, newCredential, expr } from '@n8n/workflow-sdk';

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
    credentials: { ollamaApi: newCredential('Ollama account') },
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
    credentials: { qdrantApi: newCredential('Qdrant account') },
    subnodes: { embedding: embeddings },
  },
  output: [{ document: { pageContent: '## Mon projet\nContenu...', metadata: { file: '03-Projects/MonProjet.md', category: 'projects' } } }],
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
          { id: 'context', name: 'context', value: expr('{{ $("Qdrant — Recherche").all().map((d) => "[" + (d.json.document?.metadata?.file ?? "source") + "]\\n" + (d.json.document?.pageContent ?? "")).join("\\n\\n---\\n\\n") }}'), type: 'string' },
          { id: 'question', name: 'question', value: expr('{{ $("Normaliser la question").item.json.question }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ context: '[01-Identity/About-Me.md]\n# About Me\n...', question: 'Quels sont mes projets ?' }],
});

const httpChat = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'OpenCode Go — Chat',
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
      jsonBody: expr("={{ { model: \"deepseek-v4-flash-vision-exp\", temperature: 0.2, messages: [ { role: \"system\", content: \"Tu es l'assistant personnel de Sam. Réponds UNIQUEMENT à partir du CONTEXT fourni. Cite les fichiers sources entre crochets, ex. [01-Identity/About-Me.md]. Si l'information n'y est pas, dis-le clairement.\\n\\nCONTEXT :\\n\" + $json.context }, { role: \"user\", content: $json.question } ] } }}"),
      options: { response: { response: { neverError: false } } },
    },
    credentials: { httpBearerAuth: newCredential('OpenCode Go') },
  },
  output: [{ choices: [{ message: { content: "D'après tes notes, tu as développé EasyPharma en Spring Boot [03-Projects/EasyPharma.md]." } }] }],
});

const extract = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extraire la réponse',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const answer = $json.choices?.[0]?.message?.content ?? "Erreur : aucune réponse du modèle.";\n' +
        'const sources = $("Qdrant — Recherche").all().map((d) => d.json.document?.metadata?.file).filter(Boolean);\n' +
        'return { json: { answer, sources } };',
    },
  },
  output: [{ answer: 'Réponse...', sources: ['03-Projects/EasyPharma.md'] }],
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Répondre au webhook',
    parameters: {
      respondWith: 'json',
      responseBody: expr('={{ { answer: $json.answer, sources: $json.sources } }}'),
    },
  },
  output: [{ answer: 'Réponse...', sources: ['03-Projects/EasyPharma.md'] }],
});

export default workflow('sam-second-brain-ask', 'Second Brain — Ask')
  .add(askWebhook)
  .to(normalize)
  .to(qdrantSearch)
  .to(buildContext)
  .to(httpChat)
  .to(extract)
  .to(respond);