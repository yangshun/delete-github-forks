const axios = require('axios');
const fs = require('fs');
const config = require('./config');

const username = config.github_username;
const URL = `https://api.github.com/users/${username}/repos`;
const NUMBER_OF_PAGES = 8; // Your total number of repos / page size of 30. TODO: Remove hardcoding.

async function fetchRepos(url) {
  const repos = [];
  for (let i = 1; i <= NUMBER_OF_PAGES; i++) {
    await axios.get(url, {
      params: {
        page: i,
        access_token: config.access_token,
      },
    }).then(res => {
      const forkedRepos = res.data.filter(repo => repo.fork).map(repo => repo.full_name);
      console.log(`Fetched ${forkedRepos.length} repos on page ${i}:`);
      console.log(forkedRepos);
      repos.push(...forkedRepos);
    }).catch(err => {
      console.error(`Error fetching page ${i}: ${err}`);
    });
  }
  return repos;
}

fetchRepos(URL).then(result => {
  console.log('Forked repos found:', result.length);
  console.log(result);
  fs.writeFileSync('repos.json', JSON.stringify(result, null, 2));
});
