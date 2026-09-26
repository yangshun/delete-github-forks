import { execFile } from 'node:child_process';

import type { AppStatus, GhStatus, Repository } from '../shared/types';

type ExecResult = {
  stderr: string;
  stdout: string;
};

type GitHubApiRepository = {
  archived: boolean;
  fork: boolean;
  full_name: string;
  html_url: string;
  private: boolean;
  pushed_at: string | null;
};

type GitHubUser = {
  login: string;
};

type PullRequestSummary = {
  title: string;
  url: string;
};

type RefPage = {
  nodes: Array<{
    associatedPullRequests: {
      nodes: Array<PullRequestSummary>;
      totalCount: number;
    };
    name: string;
  }>;
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
};

type BranchRef = {
  name: string;
  target: { oid: string } | null;
} | null;

type RepositoryDetails = {
  defaultBranchRef: BranchRef;
  parent: {
    defaultBranchRef: BranchRef;
    nameWithOwner: string;
  } | null;
  refs: RefPage;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export type GraphQLExecutor = <T>(
  query: string,
  variables: Record<string, string>,
) => Promise<GraphQLResponse<T>>;

export type CompareExecutor = (
  fullName: string,
  basehead: string,
) => Promise<{ aheadBy: number }>;

type GhAuthPayload = {
  hosts?: Record<
    string,
    Array<{
      active?: boolean;
      login?: string;
      scopes?: string;
      state?: string;
    }>
  >;
};

export class GitHubError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function exec(command: string, args: Array<string>): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error == null) {
          resolve({ stderr, stdout });
          return;
        }

        reject(Object.assign(error, { stderr, stdout }));
      },
    );
  });
}

function isMissingExecutable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function errorDetails(error: unknown): string {
  if (typeof error === 'object' && error != null && 'stderr' in error) {
    const stderr = String(error.stderr).trim();
    if (stderr !== '') return stderr;
  }

  return error instanceof Error ? error.message : String(error);
}

export async function detectGh(): Promise<GhStatus> {
  try {
    const { stdout } = await exec('gh', [
      'auth',
      'status',
      '--active',
      '--hostname',
      'github.com',
      '--json',
      'hosts',
    ]);
    const payload = JSON.parse(stdout) as GhAuthPayload;
    const account = payload.hosts?.['github.com']?.find(
      (candidate) => candidate.active,
    );
    const authenticated = account?.state === 'success';
    const scopes = new Set(
      (account?.scopes ?? '')
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean),
    );

    return {
      authenticated,
      hasDeleteScope: authenticated && scopes.has('delete_repo'),
      installed: true,
      username: account?.login,
    };
  } catch (error) {
    if (isMissingExecutable(error)) {
      return {
        authenticated: false,
        hasDeleteScope: false,
        installed: false,
      };
    }

    return {
      authenticated: false,
      error: errorDetails(error),
      hasDeleteScope: false,
      installed: true,
    };
  }
}

async function fetchWithToken(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(new URL(path, 'https://api.github.com/'), {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const rateLimited =
      response.status === 403 &&
      response.headers.get('x-ratelimit-remaining') === '0';
    throw new GitHubError(
      rateLimited ? 'rate_limited' : 'github_request_failed',
      `GitHub returned ${response.status} ${response.statusText}.`,
    );
  }

  return response;
}

export async function validateToken(token: string): Promise<string> {
  const response = await fetchWithToken(token, 'user');
  const scopes = response.headers.get('x-oauth-scopes');

  if (scopes != null && scopes !== '') {
    const scopeSet = new Set(scopes.split(',').map((scope) => scope.trim()));
    if (!scopeSet.has('delete_repo')) {
      throw new GitHubError(
        'token_missing_delete_scope',
        'This token does not include the delete_repo scope.',
      );
    }
  }

  const user = (await response.json()) as GitHubUser;
  return user.login;
}

function normalizeRepository(repo: GitHubApiRepository): Repository {
  return {
    aheadBy: null,
    archived: repo.archived,
    extraBranchCount: null,
    forkStatus: 'loading',
    fullName: repo.full_name,
    openPullRequestCount: null,
    openPullRequests: [],
    pullRequestStatus: 'loading',
    private: repo.private,
    pushedAt: repo.pushed_at,
    url: repo.html_url,
  };
}

function refSelection(afterVariable?: string): string {
  const after = afterVariable == null ? '' : `, after: $${afterVariable}`;
  return `refs(refPrefix: "refs/heads/", first: 100${after}) {
    nodes {
      name
      associatedPullRequests(states: [OPEN], first: 10) {
        totalCount
        nodes { title url }
      }
    }
    pageInfo { hasNextPage endCursor }
  }`;
}

function branchRefSelection(): string {
  return `name target { ... on Commit { oid } }`;
}

function forkStatusSelection(): string {
  return `defaultBranchRef { ${branchRefSelection()} }
  parent {
    nameWithOwner
    defaultBranchRef { ${branchRefSelection()} }
  }`;
}

function compareBasehead(
  parent: { defaultBranchRef: BranchRef; nameWithOwner: string },
  forkBranch: string,
): string | null {
  if (parent.defaultBranchRef?.name == null) return null;
  const [parentOwner, parentName] = parent.nameWithOwner.split('/', 2);
  return `${parentOwner}:${parentName}:${parent.defaultBranchRef.name}...${forkBranch}`;
}

async function applyForkStatus(
  repository: Repository,
  details: RepositoryDetails | null,
  compare: CompareExecutor,
): Promise<void> {
  const forkBranch = details?.defaultBranchRef;
  const parent = details?.parent;

  if (forkBranch?.target == null || parent?.defaultBranchRef?.target == null) {
    repository.forkStatus = 'unavailable';
    return;
  }

  if (forkBranch.target.oid === parent.defaultBranchRef.target.oid) {
    repository.aheadBy = 0;
    repository.forkStatus = 'loaded';
    return;
  }

  const basehead = compareBasehead(parent, forkBranch.name);
  if (basehead == null) {
    repository.forkStatus = 'unavailable';
    return;
  }

  try {
    const result = await compare(repository.fullName, basehead);
    repository.aheadBy = result.aheadBy;
    repository.forkStatus = 'loaded';
  } catch {
    repository.forkStatus = 'unavailable';
  }
}

function applyRefPage(
  repository: Repository,
  page: RefPage,
  defaultBranchName: string | null,
): void {
  const pullRequests = new Map(
    repository.openPullRequests.map((pullRequest) => [
      pullRequest.url,
      pullRequest,
    ]),
  );
  let count = repository.openPullRequestCount ?? 0;
  let extraBranches = repository.extraBranchCount ?? 0;
  for (const ref of page.nodes) {
    count += ref.associatedPullRequests.totalCount;
    for (const pullRequest of ref.associatedPullRequests.nodes) {
      pullRequests.set(pullRequest.url, pullRequest);
    }
    if (defaultBranchName != null && ref.name !== defaultBranchName) {
      extraBranches += 1;
    }
  }
  repository.openPullRequestCount = count;
  repository.openPullRequests = [...pullRequests.values()];
  repository.pullRequestStatus = 'loaded';
  if (defaultBranchName != null) repository.extraBranchCount = extraBranches;
}

export async function enrichPullRequests(
  repositories: Array<Repository>,
  executeGraphQL: GraphQLExecutor,
  compare: CompareExecutor,
): Promise<Array<Repository>> {
  const batchSize = 10;

  for (let offset = 0; offset < repositories.length; offset += batchSize) {
    const batch = repositories.slice(offset, offset + batchSize);
    const declarations: Array<string> = [];
    const fields: Array<string> = [];
    const variables: Record<string, string> = {};

    batch.forEach((repository, index) => {
      const [owner, name] = repository.fullName.split('/', 2);
      declarations.push(`$owner${index}: String!`, `$name${index}: String!`);
      fields.push(
        `r${index}: repository(owner: $owner${index}, name: $name${index}) { ${forkStatusSelection()} ${refSelection()} }`,
      );
      variables[`owner${index}`] = owner;
      variables[`name${index}`] = name;
    });

    const response = await executeGraphQL<
      Record<string, RepositoryDetails | null>
    >(`query(${declarations.join(', ')}) { ${fields.join('\n')} }`, variables);

    batch.forEach((repository, index) => {
      const result = response.data?.[`r${index}`];
      if (result != null) {
        applyRefPage(repository, result.refs, result.defaultBranchRef?.name ?? null);
      } else {
        repository.pullRequestStatus = 'unavailable';
      }
    });

    await Promise.all(
      batch.map((repository, index) =>
        applyForkStatus(repository, response.data?.[`r${index}`] ?? null, compare),
      ),
    );

    for (let index = 0; index < batch.length; index++) {
      const repository = batch[index];
      const defaultBranchName =
        response.data?.[`r${index}`]?.defaultBranchRef?.name ?? null;
      let page = response.data?.[`r${index}`]?.refs;
      while (page?.pageInfo.hasNextPage && page.pageInfo.endCursor != null) {
        const [owner, name] = repository.fullName.split('/', 2);
        const next = await executeGraphQL<{
          repository: { refs: RefPage } | null;
        }>(
          `query($owner: String!, $name: String!, $after: String!) {
            repository(owner: $owner, name: $name) { ${refSelection('after')} }
          }`,
          { after: page.pageInfo.endCursor, name, owner },
        );
        page = next.data?.repository?.refs;
        if (page != null) applyRefPage(repository, page, defaultBranchName);
      }
    }
  }

  return repositories;
}

async function graphQLWithGh<T>(
  query: string,
  variables: Record<string, string>,
): Promise<GraphQLResponse<T>> {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push('-f', `${key}=${value}`);
  }
  try {
    const { stdout } = await exec('gh', args);
    return JSON.parse(stdout) as GraphQLResponse<T>;
  } catch (error) {
    const stdout =
      typeof error === 'object' && error != null && 'stdout' in error
        ? String(error.stdout).trim()
        : '';
    if (stdout !== '') {
      return JSON.parse(stdout) as GraphQLResponse<T>;
    }
    throw error;
  }
}

async function graphQLWithToken<T>(
  token: string,
  query: string,
  variables: Record<string, string>,
): Promise<GraphQLResponse<T>> {
  const response = await fetchWithToken(token, 'graphql', {
    body: JSON.stringify({ query, variables }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  return (await response.json()) as GraphQLResponse<T>;
}

export async function listForksWithGh(): Promise<Array<Repository>> {
  try {
    const { stdout } = await exec('gh', [
      'api',
      '--paginate',
      '--slurp',
      'user/repos?affiliation=owner&visibility=all&per_page=100',
    ]);
    const pages = JSON.parse(stdout) as Array<Array<GitHubApiRepository>>;
    const repositories = pages
      .flat()
      .filter((repo) => repo.fork)
      .map(normalizeRepository);
    return repositories;
  } catch (error) {
    throw new GitHubError('gh_request_failed', errorDetails(error));
  }
}

export async function listForksWithToken(
  token: string,
): Promise<Array<Repository>> {
  const repositories: Array<GitHubApiRepository> = [];

  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      affiliation: 'owner',
      page: String(page),
      per_page: '100',
      visibility: 'all',
    });
    const response = await fetchWithToken(token, `user/repos?${query}`);
    const pageRepositories =
      (await response.json()) as Array<GitHubApiRepository>;
    repositories.push(...pageRepositories);
    if (pageRepositories.length < 100) break;
  }

  return repositories.filter((repo) => repo.fork).map(normalizeRepository);
}

async function compareWithGh(
  fullName: string,
  basehead: string,
): Promise<{ aheadBy: number }> {
  const { stdout } = await exec('gh', [
    'api',
    `repos/${fullName}/compare/${basehead}`,
  ]);
  const payload = JSON.parse(stdout) as { ahead_by: number };
  return { aheadBy: payload.ahead_by };
}

async function compareWithToken(
  token: string,
  fullName: string,
  basehead: string,
): Promise<{ aheadBy: number }> {
  const response = await fetchWithToken(
    token,
    `repos/${fullName}/compare/${basehead}`,
  );
  const payload = (await response.json()) as { ahead_by: number };
  return { aheadBy: payload.ahead_by };
}

export async function checkPullRequestsWithGh(
  repositories: Array<Repository>,
): Promise<Array<Repository>> {
  return await enrichPullRequests(
    repositories,
    graphQLWithGh,
    compareWithGh,
  );
}

export async function checkPullRequestsWithToken(
  token: string,
  repositories: Array<Repository>,
): Promise<Array<Repository>> {
  return await enrichPullRequests(
    repositories,
    (query, variables) => graphQLWithToken(token, query, variables),
    (fullName, basehead) => compareWithToken(token, fullName, basehead),
  );
}

export async function deleteWithGh(fullName: string): Promise<void> {
  try {
    await exec('gh', ['repo', 'delete', fullName, '--yes']);
  } catch (error) {
    throw new GitHubError('gh_delete_failed', errorDetails(error));
  }
}

export async function deleteWithToken(
  token: string,
  fullName: string,
): Promise<void> {
  await fetchWithToken(token, `repos/${fullName}`, { method: 'DELETE' });
}

export function getActiveMode(
  gh: GhStatus,
  tokenUsername?: string,
): AppStatus['activeMode'] {
  if (gh.authenticated && gh.hasDeleteScope) return 'gh';
  if (tokenUsername != null) return 'token';
  return null;
}
