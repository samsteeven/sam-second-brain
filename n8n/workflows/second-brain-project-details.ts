import { workflow, trigger, node, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const subTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Entrée (requête)', parameters: { inputSource: 'passthrough' } },
  output: [{ input: 'Nom du projet ou owner/repo', path: 'chemin optionnel d\'un fichier' }],
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Préparer la requête',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'const v = $json;\n' +
        'const repoArg = (typeof v === "string" ? v : (v.repo ?? v.input ?? v.query ?? v.project ?? "")).toString().trim();\n' +
        'const pathArg = (typeof v === "object" && v.path ? v.path : "").toString().trim();\n' +
        'const ALIAS = {\n' +
        '  "tribunejustice": "TribuneJusticeOrganisation/backend",\n' +
        '  "tribunejustice-frontend": "TribuneJusticeOrganisation/frontend-new",\n' +
        '  "tribunejustice-blog": "TribuneJusticeOrganisation/blog",\n' +
        '  "easypharma": "samsteeven/EasyPharma-backend",\n' +
        '  "easypharma-backend": "samsteeven/EasyPharma-backend",\n' +
        '  "second-brain": "samsteeven/sam-second-brain",\n' +
        '  "sam-second-brain": "samsteeven/sam-second-brain",\n' +
        '  "sigge": "ngomade/sigge",\n' +
        '  "digitrans": "samsteeven/digitram-cm-microservices",\n' +
        '  "portfolio": "samsteeven/mon_potfolio",\n' +
        '  "services": "samsteeven/services-samensteeve"\n' +
        '};\n' +
        'const repo = repoArg.includes("/") ? repoArg : (ALIAS[repoArg.toLowerCase()] ?? repoArg);\n' +
        'const base = "https://api.github.com/repos/" + repo;\n' +
        'const detailUrl = pathArg ? (base + "/contents/" + pathArg.split("/").map(encodeURIComponent).join("/")) : (base + "/readme");\n' +
        'const rootUrl = base + "/contents";\n' +
        'if (!repo) return { json: { error: "Repo manquant" } };\n' +
        'return { json: { repo, path: pathArg, detailUrl, rootUrl } };',
    },
  },
  output: [{ repo: 'samsteeven/sam-second-brain', path: '', detailUrl: 'https://api.github.com/repos/x/readme', rootUrl: 'https://api.github.com/repos/x/contents' }],
});

const detail = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'GitHub — Détail',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.detailUrl }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Accept', value: 'application/vnd.github.raw' }] },
      options: { response: { response: { neverError: true } } },
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{}],
});

const root = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'GitHub — Racine',
    parameters: {
      method: 'GET',
      url: expr('{{ $("Préparer la requête").item.json.rootUrl }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      options: { response: { response: { neverError: true } } },
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{ name: 'README.md', type: 'file', path: 'README.md' }],
});

const assemble = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assembler la réponse',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'const prep = $("Préparer la requête").first().json;\n' +
        'const detail = $("GitHub — Détail").first().json;\n' +
        'const entries = $("GitHub — Racine").all().map((d) => d.json);\n' +
        'let text = "";\n' +
        'if (typeof detail === "string") text = detail;\n' +
        'else if (detail && typeof detail === "object") {\n' +
        '  if (detail.content && detail.encoding === "base64") text = Buffer.from(detail.content, "base64").toString("utf8");\n' +
        '  else if (detail.message) text = "⚠️ " + detail.message;\n' +
        '  else text = JSON.stringify(detail);\n' +
        '}\n' +
        'const isError = /not found|bad credentials|forbidden|api rate limit/i.test(text.slice(0, 200));\n' +
        'const files = Array.isArray(entries) && entries.length ? entries.map((e) => e.path ?? e.name).filter(Boolean).slice(0, 40) : [];\n' +
        'const max = 6000;\n' +
        'const truncated = text.length > max;\n' +
        'const content = truncated ? text.slice(0, max) + "\\n…[contenu tronqué]" : text;\n' +
        'return [{ json: { response: { ok: !isError, repo: prep.repo, type: prep.path ? "file" : "readme", path: prep.path || null, content, files, truncated } } }];',
    },
  },
  output: [{ response: { ok: true, repo: 'samsteeven/sam-second-brain', type: 'readme', path: null, content: '# README', files: ['README.md'], truncated: false } }],
});

export default workflow('sam-second-brain-project-details', 'Second Brain — Project Details')
  .add(subTrigger)
  .to(prepare)
  .to(detail)
  .to(root)
  .to(assemble);