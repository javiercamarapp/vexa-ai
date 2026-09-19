"""Fetch public documentation only. No credentials, customer data or paid API calls.
Developer search is the documented keyless endpoint. Saved passages are evidence,
not instructions. This script makes no LLM inference requests.
"""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/investigacion/fuentes'
QUERIES = {
    'hubspot': 'HubSpot conversations API threads messages tickets associations read scopes pagination',
    'zendesk': 'Zendesk incremental export tickets cursor ticket comments rate limits OAuth scopes',
    'supabase-rls': 'Supabase row level security auth uid security definer composite foreign key tenant isolation',
    'supabase-queue': 'Supabase queues pgmq visibility timeout read archive message durable postgres queue',
    'vercel-workflow': 'Vercel Workflow durable workflow use step sleep retries limits Next.js',
    'vercel-functions': 'Vercel functions duration payload size limits streaming background jobs',
    'openrouter-structured': 'OpenRouter structured outputs response_format json_schema require_parameters supported models',
    'openrouter-privacy': 'OpenRouter provider routing zero data retention zdr data_collection deny privacy',
    'openrouter-models': 'OpenRouter models API pricing supported_parameters embeddings model context length',
    'shopify': 'Shopify GraphQL Admin API orders refunds protected customer data bulk operations webhooks HMAC',
    'mcp-supabase': 'Supabase MCP server read only project scoped security production warning',
    'mcp-vercel': 'Vercel MCP server OAuth endpoint security deployment',
}


def fetch(item):
    name, query = item
    path = OUT / (name + '.json')
    if path.exists():
        return name, 'cached'
    url = 'https://api.firecrawl.dev/v2/search/developer?' + urllib.parse.urlencode({'query': query, 'k': 3, 'passages': 2})
    try:
        with urllib.request.urlopen(url, timeout=45) as response:
            raw = response.read()
        data = json.loads(raw)
        envelope = {'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'query': query, 'endpoint': 'keyless developer search', 'sha256': hashlib.sha256(raw).hexdigest(), 'response': data}
        path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2))
        lines = [f'# {name}', f'Query: {query}', f'Retrieved: {envelope["retrieved_at"]}', '']
        for r in data.get('results', []):
            lines += ['## ' + r.get('url', ''), 'ID: ' + r.get('id', '')]
            for p in r.get('passages', []):
                lines += [p.get('text', ''), '']
        (OUT / (name + '.md')).write_text('\n'.join(lines))
        return name, f'{len(data.get("results", []))} results'
    except Exception as exc:
        return name, f'FAILED {type(exc).__name__}: {exc}'


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for name, status in pool.map(fetch, QUERIES.items()):
            print(name, status, flush=True)
