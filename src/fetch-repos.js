const axios = require('axios');
const fs = require('fs-extra');
const config = require('../config/config');
const path = require('path');

let whitelist = [];
if (fs.existsSync(path.resolve(__dirname, '../config/whitelist.json'))) {
  whitelist = require('../config/whitelist');
}

const username = config.github_username;
const URL = `${config.api_url}/users/${username}/repos`;

async function fetchRepos(url) {
  const repos = [];
  let page = 1;
  let stopFinding = false;
  while (!stopFinding) {
    await axios.get(url, {
      params: {
        page,
        access_token: config.access_token,
      },
    }).then(res => {
      if (res.data.length === 0) {
        stopFinding = true;
        return;
      }
      const forkedRepos = res.data.filter(repo => {
        if (whitelist && whitelist.indexOf(repo.full_name) !== -1) {
          return false;
        } else {
          return repo.fork;
        }
      }).map(repo => repo.full_name);
      console.log(
          `[Page ${page}] Found ${forkedRepos.length} forked repo(s) out of ${
              res.data.length
              }:`,
      );
      console.log(forkedRepos.join('\n') + '\n');
      repos.push(...forkedRepos);
      page++;
    }).catch(err => {
      console.error(`Error fetching page ${page}: ${err}`);
      stopFinding = true;
    });
  }
  return repos;
}

fetchRepos(URL).then(result => {
  console.log('Forked repos found:', result.length);
  console.log(result.join('\n'));
  fs.writeFileSync(path.resolve(__dirname, '../reposForDeletion.json'), JSON.stringify(result, null, 2));
});
