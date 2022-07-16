const axios = require('axios');
const fs = require('fs');
const path = require('path');

const config = require('./config');

const username = config.github_username;
const URL = `${config.api_url}/users/${username}/repos`;
const OUT_FILE = 'src/repos.json';

async function fetchRepos(url) {
  const repos = [];
  let page = 1;

  while (true) {
    try {
      const res = await axios.get(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${config.access_token}`,
        },
        params: {
          page,
        },
      });

      if (res.data.length === 0) {
        break;
      }

      const forkedRepos = res.data
        .filter((repo) => repo.fork)
        .map((repo) => repo.full_name);
      console.log(`[Page ${page}] Found ${forkedRepos.length} forked repo(s):`);
      console.log(forkedRepos.map((repo) => `- ${repo}`).join('\n') + '\n');
      repos.push(...forkedRepos);
      page++;
    } catch (err) {
      console.error(`Error fetching page ${page}: ${err}`);
      break;
    }
  }

  return repos;
}

fetchRepos(URL).then((result) => {
  console.log('Forked repos found:', result.length);
  console.log(result.map((repo) => `- ${repo}`).join('\n'));
  console.log();
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  console.log(
    `Wrote forked repos into "${path.join(process.cwd(), OUT_FILE)}"`,
  );
});
