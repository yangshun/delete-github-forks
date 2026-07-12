import fs from 'node:fs';
import path from 'node:path';

import { getConfig, githubHeaders } from './github';

type GitHubRepository = {
  fork: boolean;
  full_name: string;
};

const config = getConfig();
const URL = `${config.apiUrl}/user/repos`;
const OUT_FILE = 'src/repos.json';

async function fetchRepos(url: string): Promise<Array<string>> {
  const repos: Array<string> = [];
  let page = 1;

  while (true) {
    const query = new URLSearchParams({
      affiliation: 'owner',
      page: String(page),
      per_page: '100',
      visibility: 'all',
    });

    try {
      const response = await fetch(`${url}?${query}`, {
        headers: githubHeaders(config.accessToken),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const pageRepos = (await response.json()) as Array<GitHubRepository>;
      if (pageRepos.length === 0) {
        break;
      }

      const forkedRepos = pageRepos
        .filter((repo) => repo.fork)
        .map((repo) => repo.full_name);
      console.log(`[Page ${page}] Found ${forkedRepos.length} forked repo(s):`);
      console.log(forkedRepos.map((repo) => `- ${repo}`).join('\n') + '\n');
      repos.push(...forkedRepos);
      page++;
    } catch (error) {
      console.error(`Error fetching page ${page}: ${String(error)}`);
      break;
    }
  }

  return repos;
}

const result = await fetchRepos(URL);
console.log('Forked repos found:', result.length);
console.log(result.map((repo) => `- ${repo}`).join('\n'));
console.log();
fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`Wrote forked repos into "${path.join(process.cwd(), OUT_FILE)}"`);
