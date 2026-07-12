# Delete GitHub Forks

Delete your forked GitHub repositories easily in two steps (takes less than 5 minutes).

## Motivation

Deleting GitHub repositories via the GitHub interface is a hassle; you have to enter your password followed by the name of the repository. This is not scalable if you contribute to open source a fair bit and have many forked repositories that you may not necessarily want to keep.

Using these scripts, you can fetch a list of your GitHub repositories and delete all the unwanted repositories in one go.

<!-- prettier-ignore -->
> [!TIP]
> If you use an AI coding agent with access to the GitHub CLI, you can run this workflow without cloning the repository. Give the agent the following prompt:
>
> ```text
> Use the authenticated GitHub CLI (`gh`) to find all forked repositories owned by my GitHub account, including private repositories.
>
> First, verify that `gh` is installed and authenticated. Fetch every page of results, then show me the complete list of forks. Let me remove repositories I want to keep.
>
> Do not delete, archive, or modify any repository until I explicitly confirm the final deletion list. After confirmation, use `gh` to delete only the confirmed repositories and report every success or failure.
> ```

## Getting Started

Clone this repository.

Node.js 18 or newer is required.

```
$ npm install
$ cp src/config.json.example src/config.json
```

Add your GitHub access token to `config.json`.

- For a [personal access token (classic)](https://github.com/settings/tokens/new), grant the `repo` and `delete_repo` scopes.
- For a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new), select the repositories to manage and grant **Metadata: Read** and **Administration: Read and write** permissions.

The scripts support both public and private repositories that you own and that the token can access.

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
