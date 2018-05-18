const axios = require('axios');
const fs = require('fs');
const config = require('./config');

const reposForDeletion = require('./repos');

function deleteRepos(repos) {
  repos.forEach(async repo => {
    const URL = `${config.api_url}/repos/${repo}`;
    await axios({
      method: 'delete',
      url: URL,
      params: {
        access_token: config.access_token,
      },
    })
      .then(() => {
        console.log(`${repo} deleted!`);
      })
      .catch(() => {
        console.error(`Error deleting ${repo}...`);
      });
  });
}

deleteRepos(reposForDeletion);
