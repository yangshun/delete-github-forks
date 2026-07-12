import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import getPort, { portNumbers } from 'get-port';
import open from 'open';

import { createApp } from './app';

type CliOptions = {
  openBrowser: boolean;
  port?: number;
};

function printHelp(): void {
  console.log(`Delete GitHub Forks

Usage: delete-github-forks [options]

Options:
  --port <number>  Use a specific port (default: 4173, then next available)
  --no-open        Do not open the browser automatically
  -h, --help       Show this help`);
}

function parseArgs(args: Array<string>): CliOptions {
  let openBrowser = true;
  let port: number | undefined;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--no-open') {
      openBrowser = false;
    } else if (argument === '--port') {
      const value = args[++index];
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
        throw new Error('--port must be an integer between 1 and 65535.');
      }
      port = parsed;
    } else if (argument === '--help' || argument === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { openBrowser, port };
}

async function main(): Promise<void> {
  const cliOptions = parseArgs(process.argv.slice(2));
  const port =
    cliOptions.port ??
    (await getPort({
      host: '127.0.0.1',
      port: portNumbers(4173, 4273),
    }));
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const clientRoot = path.join(directory, 'client');
  if (!fs.existsSync(path.join(clientRoot, 'index.html'))) {
    throw new Error('The web app assets are missing. Reinstall the package.');
  }

  const origin = { value: '' };
  const app = createApp({
    clientRoot,
    origin,
    sessionToken: randomBytes(32).toString('hex'),
  });

  const server = serve(
    {
      fetch: app.fetch,
      hostname: '127.0.0.1',
      port,
    },
    async ({ port }) => {
      origin.value = `http://127.0.0.1:${port}`;
      console.log(`Delete GitHub Forks is running at ${origin.value}`);
      console.log('Press Ctrl+C to stop.');
      if (cliOptions.openBrowser) {
        await open(origin.value);
      }
    },
  );

  const stop = (): void => {
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
