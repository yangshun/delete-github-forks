# Delete GitHub Forks

Delete your forked GitHub repositories easily in two steps.

**Note:** Node 8+ is required because some new language features are used.

## Motivations

Deleting GitHub repositories via the GitHub interface is a hassle; you have to enter your password followed by the name of the repository. This is not scalable if you contribute to open source a fair bit and have many forked repositories that you may not necessarily want to keep. Using this script, you can fetch a list of your GitHub repositories and delete the unwanted repositories in one go.

## Getting Started

Clone this repository.

```
$ npm install
$ cp src/config.json.example src/config.json
```

Add your GitHub username and access token to `config.json`. To get the access token, go to [this page](https://github.com/settings/tokens/new) and create a token that has the following permissions: `public_repo` and `delete_repo`. For better security you can use the `config.example.js` and use ENV variables for GitHub username and access token.

## Usage

Firstly, run the following command to fetch all your forked repositories.

```sh
$ node src/fetch-repos.js
```

A JSON file, `reposForDeletion.json` containing an array of your forked repositories will be written into the root directory.

**The repositories inside `reposForDeletion.json` will be deleted. It is an irreversible operation. Use with great caution!**.

So, before running the next command, manually inspect `reposForDeletion.json` and remove the forked repositories that you want to keep.

Finally, to delete all the repos in `reposForDeletion.json`, run

```sh
$ node src/delete-repos.js
```

Done. It's that easy.


### Whitelists

A better option to avoid deleting important forks is to create a `whitelist.json` config file. To create it run
```sh
$ node src/fetch-repos.js
$ mv reposForDeletions.json config/whitelist.json
```
After, edit the `whitelist.json` file, leave in it only the repos you don't want to delete and run again
```sh
$ node src/fetch-repos.js
```
You will see that the new `reposForDeletion.json` file does not contains the whitelisted repos.

### History

Any time you delete some forked repo, a report json file will be created in the `history` directory. This way you know which repos you deleted and when. Also, you will see which repos were not deleteable and which error was returned by the GitHub API.

## Wanted

The scripts can be potentially modified to work on an organization's repositories as well just by changing the URLs. Pull requests to support this feature are welcome.

## License

MIT
