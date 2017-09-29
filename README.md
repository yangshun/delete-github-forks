Delete GitHub Forks
==

Delete your forked GitHub repositories easily in two steps.

## Getting Started

```
$ npm install
$ cp src/config.json.example src/config.json
```

Create a personal GitHub token on [this page](https://github.com/settings/tokens/new) that has the following permissions: `public_repo` and `delete_repo` and add it to the copied `config.json`.

## Usage

Firstly, run the following command to fetch all your forked repositories.

```sh
$ cd src
$ node fetch-repos.js
```

A JSON file containing an array of your repositories will be written into the same directory. Manually inspect it and remove the forked repositories that you want to keep. **The repositories that remain inside `repos.json` will be deleted on the next command. It is an irreversible operation. Use with great caution!**.

```sh
$ node delete-repos.js
```

And all the repositories within `repos.json` will be deleted! It's that easy.

The scripts can be potentially modified to work on an organization's repositories as well just by changing the URLs. Pull requests to support this feature are welcome.

## License

MIT
