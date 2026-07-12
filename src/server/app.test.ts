// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './app';

const roots: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { force: true, recursive: true })),
  );
});

async function testApp() {
  const clientRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-forks-'));
  roots.push(clientRoot);
  await fs.writeFile(
    path.join(clientRoot, 'index.html'),
    '<meta name="session-token" content="__SESSION_TOKEN__">',
  );
  return createApp({
    clientRoot,
    origin: { value: 'http://127.0.0.1:3000' },
    sessionToken: 'secret',
  });
}

describe('local app security', () => {
  it('rejects API calls without the per-process secret', async () => {
    const app = await testApp();
    const response = await app.request('/api/status');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_session' },
    });
  });

  it('rejects cross-origin API calls', async () => {
    const app = await testApp();
    const response = await app.request(
      new Request('http://127.0.0.1:3000/api/status', {
        headers: {
          origin: 'https://example.com',
          'x-session-token': 'secret',
        },
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_origin' },
    });
  });

  it('injects the secret and security headers into the app shell', async () => {
    const app = await testApp();
    const response = await app.request('/');
    expect(await response.text()).toContain('content="secret"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'self'",
    );
  });
});
