import { workflow, trigger, tool, newCredential, fromAi } from '@n8n/workflow-sdk';

const kbTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 1,
  config: {
    name: 'second_brain_ask',
    parameters: {
      name: 'second_brain_ask',
      description: 'Interroge la base de connaissances personnelle de Sam : ses projets, sa stack technique, son parcours, ses compétences, sa recherche de stage. Pose une question en français ou en anglais, la réponse est accompagnée des sources.',
      source: 'database',
      workflowId: 'dWn9Dm1dvc5Qi13H',
      responsePropertyName: 'response',
    },
  },
});

const mcpServer = trigger({
  type: '@n8n/n8n-nodes-langchain.mcpTrigger',
  version: 2,
  config: {
    name: 'MCP Server — Second Brain',
    parameters: {
      authentication: 'bearerAuth',
      path: 'second-brain-kb',
    },
    credentials: { httpBearerAuth: newCredential('MCP Second Brain') },
    subnodes: { tools: [kbTool] },
  },
});

export default workflow('sam-second-brain-mcp', 'Second Brain — MCP Server')
  .add(mcpServer);