import { execFile } from 'node:child_process';

import { config as loadEnv } from 'dotenv';

loadEnv({ quiet: true });

type GitHubRequestOptions = {
  method?: 'DELETE' | 'GET';
};

function runGitHubCli(args: Array<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'gh',
      args,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error == null) {
          resolve(stdout);
          return;
        }

        const details = stderr.trim() || error.message;
        reject(
          new Error(
            `GitHub CLI request failed. Run \`gh auth status\` and ensure the required scopes are granted. ${details}`,
          ),
        );
      },
    );
  });
}

export async function githubRequest<T>(
  path: string,
  options: GitHubRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const accessToken = process.env.GITHUB_TOKEN;

  if (accessToken == null || accessToken === '') {
    const stdout = await runGitHubCli([
      'api',
      '--method',
      method,
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
      path,
    ]);

    return (stdout.trim() === '' ? undefined : JSON.parse(stdout)) as T;
  }

  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const response = await fetch(new URL(path, `${apiUrl}/`), {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    method,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}
