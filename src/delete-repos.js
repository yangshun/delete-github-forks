const axios = require('axios');
const config = require('../config/config');
const path = require('path');
const fs = require('fs-extra');

try {

  const rfdPath = path.resolve(__dirname, '../reposForDeletion.json');
  const reposForDeletion = require(rfdPath);
  const deleted = [];
  const notDeleted = [];

  function history() {
    const historyDir = path.resolve(__dirname, '../history');
    fs.ensureDirSync(historyDir);
    const report = {
      deleted,
      notDeleted
    };

    fs.writeFileSync(path.join(historyDir, `report-${(new Date).toISOString()}.json`), JSON.stringify(report, null, 2));
    fs.writeFileSync(rfdPath, '[]');
  }

  function deleteRepos(repos) {
    let len = repos.length;
    repos.forEach(async repo => {
      const URL = `${config.api_url}/repos/${repo}`;
      await axios({
        method: 'delete',
        url: URL,
        params: {
          access_token: config.access_token,
        },
      }).then(() => {
        console.log(`${repo} deleted!`);
        deleted.push(repo);
        !(--len) && history();
      }).catch(error => {
        console.error(`Error deleting ${repo}...`);
        notDeleted.push({
          repo,
          error: error.message
        });
        !(--len) && history();
      });
    });
  }

  deleteRepos(reposForDeletion);

} catch (err) {

  console.error('No file "reposForDeletion.json" found.');
}
