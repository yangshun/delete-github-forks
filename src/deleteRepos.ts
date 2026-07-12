import fs from 'node:fs';
import readline from 'node:readline';

import { getConfig, githubHeaders } from './github';

const config = getConfig();
const reposForDeletion = JSON.parse(
  fs.readFileSync('src/repos.json', 'utf8'),
) as Array<string>;

async function deleteRepos(repos: Array<string>): Promise<void> {
  let deleted = 0;
  let failed = 0;

  for (const repo of repos) {
    const url = `${config.api_url}/repos/${repo}`;

    try {
      const response = await fetch(url, {
        headers: githubHeaders(config.access_token),
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      deleted++;
      console.log(`${repo} deleted!`);
    } catch (error) {
      failed++;
      console.error(`Error deleting ${repo}: ${String(error)}`);
    }
  }

  if (deleted > 0) {
    console.log(`${deleted} repo(s) deleted!`);
  }

  if (failed > 0) {
    console.log(`Failed to delete ${failed} repo(s)`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

console.log('The following repos will be deleted:');
console.log(reposForDeletion.map((repo) => `- ${repo}`).join('\n'));
console.log();
console.log('Are you sure you want to delete the following repos? y/n');

rl.on('line', async (line) => {
  if (line.trim().toLowerCase() === 'y') {
    console.log();
    await deleteRepos(reposForDeletion);
  }

  rl.close();
});
