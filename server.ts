import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  createServer,
  Tool,
  ListResourcesRequest,
  ListResourcesResult,
  GetResourceRequest,
  GetResourceResult
} from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamable-http.js';

type ImageItem = {
  id: string;
  title: string;
  url: string;
  caption: string;
  tags?: string[];
};

const catalogPath = path.join(process.cwd(), 'src', 'images.json');
const CATALOG: ImageItem[] = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

function tokenize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreItem(item: ImageItem, qTokens: string[]): number {
  const hay = tokenize(
    [item.title, item.caption, (item.tags || []).join(' ')].join(' ')
  );
  let score = 0;
  for (const qt of qTokens) {
    if (hay.includes(qt)) score += 3;
    else if (hay.some(h => h.includes(qt))) score += 1;
  }
  const tagStr = (item.tags || []).join(' ').toLowerCase();
  for (const qt of qTokens) {
    if (tagStr.includes(qt)) score += 0.5;
  }
  return score;
}

const searchImagesTool: Tool = {
  name: 'search_images',
  description:
    'Keyword search over the image catalog (title, caption, tags). Returns top matches with URLs.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'keywords, e.g., "watercolor blue dog"' },
      k: { type: 'number', description: 'how many results to return (default 6)' },
      mode: {
        type: 'string',
        enum: ['any', 'all'],
        description: 'any = OR match, all = must include every keyword (default any)'
      }
    },
    required: ['query']
  },
  async invoke({ arguments: args }) {
    const schema = z.object({
      query: z.string(),
      k: z.number().optional(),
      mode: z.enum(['any', 'all']).optional()
    });
    const { query, k, mode } = schema.parse(args || {});
    const qTokens = tokenize(query);
    const filtered =
      (mode || 'any') === 'all'
        ? CATALOG.filter(it => {
            const text = [it.title, it.caption, (it.tags || []).join(' ')]
              .join(' ')
              .toLowerCase();
            return qTokens.every(t => text.includes(t));
          })
        : CATALOG;

    const scored = filtered
      .map(item => ({ ...item, score: scoreItem(item, qTokens) }))
      .filter(x => x.score > 0 || qTokens.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k ?? 6);

    return {
      content: [{ type: 'text', text: JSON.stringify(scored, null, 2) }]
    };
  }
};

async function listResources(_req: ListResourcesRequest): Promise<ListResourcesResult> {
  return {
    resources: CATALOG.map(i => ({
      uri: `image://${i.id}`,
      mimeType: 'application/json',
      name: i.title,
      description: i.caption
    }))
  };
}

async function getResource(req: GetResourceRequest): Promise<GetResourceResult> {
  const id = req.uri.replace('image://', '');
  const found = CATALOG.find(i => i.id === id);
  if (!found) throw new Error(`Not found: ${req.uri}`);
  return {
    contents: [
      {
        uri: req.uri,
        mimeType: 'application/json',
        text: JSON.stringify(found)
      }
    ]
  };
}

async function main() {
  const app = express();
  const mcp = createServer(
    { name: 'image-keyphrase-mcp', version: '1.0.0' },
    {
      resources: { listResources, getResource },
      tools: { search_images: searchImagesTool }
    }
  );

  const transport = new StreamableHTTPServerTransport({
    endpoint: '/mcp',
    sseEndpoint: '/sse'
  });
  transport.register(app, mcp);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => {
    console.log(`MCP server on http://localhost:${port}/mcp (SSE at /sse)`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
