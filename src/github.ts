import fs from 'node:fs';

type Config = {
  access_token: string;
  api_url: string;
};

export function getConfig(): Config {
  return JSON.parse(fs.readFileSync('src/config.json', 'utf8')) as Config;
}

export function githubHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
