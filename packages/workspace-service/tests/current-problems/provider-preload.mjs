import fs from 'node:fs';
const original = globalThis.fetch;
const record = (value) => fs.appendFileSync(process.env.SYN_HISTORY_PROVIDER_LOG, JSON.stringify(value) + '\n');
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  const stamp = '2026-09-10T12:00:00Z';
  if (url.origin === 'https://synthetic-vexa.zendesk.com') {
    if (new Headers(init?.headers).get('authorization') !== 'Bearer SYN-HISTORY-SECRET') throw Error('SYN_CREDENTIAL_REQUIRED');
    record({ provider: 'SYN-local-in-process-zendesk', path: url.pathname });
    if (url.pathname.includes('/incremental/')) return Response.json({ tickets: Array.from({ length: 102 }, (_, i) => ({ id: 1000 + i, status: 'open', created_at: stamp, updated_at: stamp })), after_cursor: 'SYN-history-end', end_of_stream: true });
    if (url.pathname.includes('/comments')) {
      const ticket = Number(url.pathname.match(/tickets\/(\d+)/)?.[1]);
      return Response.json({ comments: [{ id: 5000 + ticket, author_id: 7, public: true, plain_body: 'SYN Ana Pérez ana@example.test: batería rota en pedido histórico ' + ticket, created_at: stamp }], meta: { has_more: false }, links: { next: null } });
    }
    if (url.pathname.includes('/users/7')) return Response.json({ user: { id: 7, role: 'end-user' } });
    return Response.json({}, { status: 404 });
  }
  if (url.origin === 'https://openrouter.ai') {
    const body = JSON.parse(init.body);
    if (url.pathname.endsWith('/embeddings')) {
      record({ provider: 'SYN-local-in-process-embedding', path: url.pathname, inputs: body.input.length });
      return Response.json({ model: 'synthetic/model', data: body.input.map((_, index) => ({ index, embedding: [1, 0, 0] })), usage: { prompt_tokens: 10, total_tokens: 10, cost: '0.000010' } });
    }
    const data = JSON.parse(body.messages.find((message) => message.role === 'user').content), revision = data.revisions[0], quote = 'batería rota';
    if (JSON.stringify(data).includes('Ana Pérez') || JSON.stringify(data).includes('ana@example.test')) throw Error('RAW_PII_REACHED_SYN_PROVIDER');
    const start = [...revision.text.slice(0, revision.text.indexOf(quote))].length;
    record({ provider: 'SYN-local-in-process-extraction', path: url.pathname, redacted: true, revision: revision.message_revision_id });
    const result = { issues: [{ category: 'battery', severity: 'high', evidence: [{ message_revision_id: revision.message_revision_id, start, end: start + [...quote].length, quote, role: 'customer' }] }], sentiment: 'negative', intent: 'complaint', urgency: 'normal', entities: [], abstention: null };
    return Response.json({ id: 'SYN-HISTORY-EXTRACTION', usage: {}, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('EXTERNAL_NETWORK_FORBIDDEN');
  return original(input, init);
};
