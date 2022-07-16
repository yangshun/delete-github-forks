const axios = require('axios');
const config = require('./config');
const readline = require('readline');

const reposForDeletion = require('./repos');

async function deleteRepos(repos) {
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const URL = `${config.api_url}/repos/${repo}`;

    try {
      await axios.delete(URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${config.access_token}`,
        },
      });
      deleted++;
      console.log(`${repo} deleted!`);
    } catch (err) {
      failed++;
      console.error(`Error deleting ${repo}`);
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

rl.on('line', async function (line) {
  if (line.trim().toLowerCase() === 'y') {
    console.log();
    await deleteRepos(reposForDeletion);
  }

  // Terminate the process.
  rl.close();
});
