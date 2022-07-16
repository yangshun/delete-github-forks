# Delete GitHub Forks

Delete your forked GitHub repositories easily in two steps (takes less than 5 minutes).

## Motivation

Deleting GitHub repositories via the GitHub interface is a hassle; you have to enter your password followed by the name of the repository. This is not scalable if you contribute to open source a fair bit and have many forked repositories that you may not necessarily want to keep.

Using these scripts, you can fetch a list of your GitHub repositories and delete all the unwanted repositories in one go.

## Getting Started

Clone this repository.

```
$ npm install
$ cp src/config.json.example src/config.json
```

Add your GitHub username and access token to `config.json`. To get the access token, go to [this page](https://github.com/settings/tokens/new) and create a token that has the following permissions: `public_repo` and `delete_repo`.

## Usage

Firstly, run the following command to fetch all your forked repositories.

```sh
$ npm run fetch # Writes to a src/repos.json file
```

A JSON file, `src/repos.json` containing an array of your repositories will be written into the same directory. Manually inspect it and remove the forked repositories that you want to keep. **The repositories that remain inside `src/repos.json` will be deleted on the next command. It is an irreversible operation. Use with great caution!**.

```sh
$ npm run delete # Reads from src/repos.json and deletes the repos inside it.
```

And all the repositories within `src/repos.json` will be deleted! It's that easy.

The scripts can be potentially modified to work on an organization's repositories as well just by changing the URLs. Pull requests to support this feature are welcome.

## License

MIT
