import { config as loadEnv } from 'dotenv';

loadEnv({ quiet: true });

type Config = {
  accessToken: string;
  apiUrl: string;
};

export function getConfig(): Config {
  const accessToken = process.env.GITHUB_TOKEN;

  if (accessToken == null || accessToken === '') {
    throw new Error('GITHUB_TOKEN is required. Add it to your .env file.');
  }

  return {
    accessToken,
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
  };
}

export function githubHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
