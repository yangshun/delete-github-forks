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

Add your GitHub username and access token to `config.json`. To get the access token, go to [this page](https://github.com/settings/tokens/new) and create a token that has the following permissions: `public_repo` and `delete_repo`.

## Usage

Firstly, run the following command to fetch all your forked repositories.

```sh
$ cd src
$ node fetch-repos.js # Writes to a repos.json file.
```

A JSON file, `repos.json` containing an array of your repositories will be written into the same directory. Manually inspect it and remove the forked repositories that you want to keep. **The repositories that remain inside `repos.json` will be deleted on the next command. It is an irreversible operation. Use with great caution!**.

```sh
$ node delete-repos.js # Reads from repos.json and deletes the repos inside it.
```

And all the repositories within `repos.json` will be deleted! It's that easy.

The scripts can be potentially modified to work on an organization's repositories as well just by changing the URLs. Pull requests to support this feature are welcome.

## License

MIT
