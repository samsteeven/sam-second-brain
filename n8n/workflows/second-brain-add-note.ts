import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const subTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Entrée (note)',
    parameters: { inputSource: 'passthrough' },
  },
  output: [{ input: 'Contenu de la note en markdown', title: 'Titre optionnel' }],
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Préparer la note',
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
        'let body;\n' +
        'if (raw.startsWith("---")) { body = raw; } else {\n' +
        '  const hasHeading = /^#\\s+/m.test(raw);\n' +
        '  body = `---\\ntype: note\\nstatus: active\\nimportance: medium\\nsource: ia\\ncreated: ${date}\\ntags: [ia, capture]\\n---\\n\\n${hasHeading ? "" : "# " + title + "\\n\\n"}${raw}`;\n' +
        '}\n' +
        'return { json: { path: "99-Capture/" + date + "-" + slug + ".md", contentBase64: Buffer.from(body, "utf8").toString("base64"), message: "Note ajoutée par IA : " + title } };',
    },
  },
  output: [{ path: '99-Capture/2026-09-19-idee.md', contentBase64: 'IyBJZGVl', message: 'Note ajoutée par IA' }],
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
  output: [{ content: { path: '99-Capture/2026-09-19-idee.md', sha: 'abc123' }, commit: { sha: 'def456' } }],
});

const format = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Formater la réponse',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: 'return { json: { response: { ok: true, path: $json.content?.path, commit: $json.commit?.sha ?? null } } };',
    },
  },
  output: [{ response: { ok: true, path: '99-Capture/2026-09-19-idee.md', commit: 'def456' } }],
});

export default workflow('sam-second-brain-add-note', 'Second Brain — Add Note')
  .add(subTrigger)
  .to(prepare)
  .to(write)
  .to(format);