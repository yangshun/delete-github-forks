import fs from 'node:fs/promises';
import path from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import type {
  ApiErrorBody,
  AppStatus,
  DeleteResult,
  Repository,
} from '../shared/types';
import {
  checkPullRequestsWithGh,
  checkPullRequestsWithToken,
  deleteWithGh,
  deleteWithToken,
  detectGh,
  getActiveMode,
  GitHubError,
  listForksWithGh,
  listForksWithToken,
  validateToken,
} from './github';

type AppOptions = {
  clientRoot: string;
  origin: { value: string };
  sessionToken: string;
};

function apiError(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono();
  let accessToken: string | undefined;
  let tokenUsername: string | undefined;
  const repositorySnapshot = new Map<string, Repository>();

  app.use('*', async (context, next) => {
    await next();
    context.header('Cache-Control', 'no-store');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('X-Frame-Options', 'DENY');
    context.header(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src https://fonts.gstatic.com; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com",
    );
  });

  app.use('/api/*', async (context, next) => {
    if (context.req.header('x-session-token') !== options.sessionToken) {
      return context.json(
        apiError('invalid_session', 'The local app session is invalid.'),
        403,
      );
    }

    const origin = context.req.header('origin');
    if (origin != null && origin !== options.origin.value) {
      return context.json(
        apiError('invalid_origin', 'Cross-origin requests are not allowed.'),
        403,
      );
    }

    await next();
  });

  async function status(): Promise<AppStatus> {
    const gh = await detectGh();
    return {
      activeMode: getActiveMode(gh, tokenUsername),
      gh,
      tokenUsername,
    };
  }

  app.get('/api/status', async (context) => context.json(await status()));

  app.post('/api/auth/token', async (context) => {
    const body = (await context.req.json().catch(() => null)) as {
      token?: unknown;
    } | null;
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (token === '' || token.length > 500) {
      return context.json(
        apiError('invalid_token', 'Enter a valid GitHub access token.'),
        400,
      );
    }

    tokenUsername = await validateToken(token);
    accessToken = token;
    repositorySnapshot.clear();
    return context.json(await status());
  });

  app.delete('/api/auth/token', async (context) => {
    accessToken = undefined;
    tokenUsername = undefined;
    repositorySnapshot.clear();
    return context.json(await status());
  });

  app.get('/api/repos', async (context) => {
    const currentStatus = await status();
    let repositories: Array<Repository>;

    if (currentStatus.activeMode === 'gh') {
      repositories = await listForksWithGh();
    } else if (currentStatus.activeMode === 'token' && accessToken != null) {
      repositories = await listForksWithToken(accessToken);
    } else {
      return context.json(
        apiError(
          'authentication_required',
          'Configure GitHub CLI or provide an access token first.',
        ),
        401,
      );
    }

    repositories.sort((left, right) =>
      (left.pushedAt ?? '').localeCompare(right.pushedAt ?? ''),
    );
    repositorySnapshot.clear();
    for (const repository of repositories) {
      repositorySnapshot.set(repository.fullName, repository);
    }

    return context.json(repositories);
  });

  app.post('/api/repos/pull-requests', async (context) => {
    const body = (await context.req.json().catch(() => null)) as {
      repositories?: unknown;
    } | null;
    const names = Array.isArray(body?.repositories)
      ? body.repositories.filter(
          (name): name is string => typeof name === 'string',
        )
      : [];

    if (names.length === 0 || names.length > 10) {
      return context.json(
        apiError(
          'invalid_selection',
          'Request between one and ten repositories.',
        ),
        400,
      );
    }

    const repositories = names.map((name) => repositorySnapshot.get(name));
    if (repositories.some((repository) => repository == null)) {
      return context.json(
        apiError(
          'repository_not_allowed',
          'Refresh the repository list before checking this selection.',
        ),
        400,
      );
    }

    const currentStatus = await status();
    const allowedRepositories = repositories as Array<Repository>;
    if (currentStatus.activeMode === 'gh') {
      await checkPullRequestsWithGh(allowedRepositories);
    } else if (currentStatus.activeMode === 'token' && accessToken != null) {
      await checkPullRequestsWithToken(accessToken, allowedRepositories);
    } else {
      return context.json(
        apiError('authentication_required', 'Authentication is unavailable.'),
        401,
      );
    }

    return context.json(allowedRepositories);
  });

  app.post('/api/repos/delete', async (context) => {
    const body = (await context.req.json().catch(() => null)) as {
      repositories?: unknown;
    } | null;
    const names = Array.isArray(body?.repositories)
      ? body.repositories.filter(
          (name): name is string => typeof name === 'string',
        )
      : [];

    if (names.length === 0 || names.length > 1000) {
      return context.json(
        apiError('invalid_selection', 'Select at least one repository.'),
        400,
      );
    }

    if (names.some((name) => !repositorySnapshot.has(name))) {
      return context.json(
        apiError(
          'repository_not_allowed',
          'Refresh the repository list before deleting this selection.',
        ),
        400,
      );
    }

    const currentStatus = await status();
    const results: Array<DeleteResult> = [];

    for (const name of names) {
      try {
        if (currentStatus.activeMode === 'gh') {
          await deleteWithGh(name);
        } else if (
          currentStatus.activeMode === 'token' &&
          accessToken != null
        ) {
          await deleteWithToken(accessToken, name);
        } else {
          throw new GitHubError(
            'authentication_required',
            'Authentication is no longer available.',
          );
        }
        repositorySnapshot.delete(name);
        results.push({ name, success: true });
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : String(error),
          name,
          success: false,
        });
      }
    }

    return context.json(results);
  });

  app.onError((error, context) => {
    if (error instanceof GitHubError) {
      const statusCode = error.code === 'rate_limited' ? 429 : 502;
      return context.json(apiError(error.code, error.message), statusCode);
    }

    return context.json(
      apiError('internal_error', 'The local server encountered an error.'),
      500,
    );
  });

  app.get('/', async (context) => {
    const html = await fs.readFile(
      path.join(options.clientRoot, 'index.html'),
      'utf8',
    );
    return context.html(
      html.replace('__SESSION_TOKEN__', options.sessionToken),
    );
  });

  app.use(
    '*',
    serveStatic({
      root: options.clientRoot,
    }),
  );

  return app;
}
