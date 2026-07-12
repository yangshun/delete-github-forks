import type {
  ApiErrorBody,
  AppStatus,
  DeleteResult,
  Repository,
} from '../shared/types';

const sessionToken =
  document
    .querySelector<HTMLMetaElement>('meta[name="session-token"]')
    ?.getAttribute('content') ?? '';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': sessionToken,
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T | ApiErrorBody;
  if (!response.ok) {
    const error = (body as ApiErrorBody).error;
    throw new ApiError(error.code, error.message);
  }
  return body as T;
}

export const api = {
  clearToken: () => request<AppStatus>('/api/auth/token', { method: 'DELETE' }),
  deleteRepositories: (repositories: Array<string>) =>
    request<Array<DeleteResult>>('/api/repos/delete', {
      body: JSON.stringify({ repositories }),
      method: 'POST',
    }),
  getPullRequestData: (repositories: Array<string>) =>
    request<Array<Repository>>('/api/repos/pull-requests', {
      body: JSON.stringify({ repositories }),
      method: 'POST',
    }),
  getRepositories: () => request<Array<Repository>>('/api/repos'),
  getStatus: () => request<AppStatus>('/api/status'),
  setToken: (token: string) =>
    request<AppStatus>('/api/auth/token', {
      body: JSON.stringify({ token }),
      method: 'POST',
    }),
};
