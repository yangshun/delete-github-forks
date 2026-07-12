import { useState, type FormEvent } from 'react';

import type { AppStatus } from '../../shared/types';

type AuthSetupProps = {
  onCheckAgain: () => Promise<void>;
  onSubmitToken: (token: string) => Promise<void>;
  status: AppStatus;
};

export function AuthSetup({
  onCheckAgain,
  onSubmitToken,
  status,
}: AuthSetupProps) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.trim() === '') return;
    setSaving(true);
    try {
      await onSubmitToken(token);
      setToken('');
    } catch {
      // The parent renders the API error and the token remains available to edit.
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="connection-options"
      aria-labelledby="connection-heading">
      <div className="connection-heading">
        <h2 id="connection-heading">Choose how to connect</h2>
        <p>Use either option below to give this local app access to GitHub.</p>
      </div>
      <div className="onboarding-grid">
        <article className="card setup-card setup-primary">
          <span className="option-badge option-badge-recommended">
            Recommended
          </span>
          <div className="card-heading">
            <span className="option-number" aria-hidden="true">
              1
            </span>
            <h3>Use GitHub CLI</h3>
          </div>
          {!status.gh.installed ? (
            <>
              <p>
                Install GitHub CLI, then authenticate it for repository access.
              </p>
              <a
                className="button button-secondary"
                href="https://cli.github.com/"
                rel="noreferrer"
                target="_blank">
                Install GitHub CLI
              </a>
              <pre>
                <code>gh auth login -h github.com -s delete_repo --web</code>
              </pre>
            </>
          ) : !status.gh.authenticated ? (
            <>
              <p>
                GitHub CLI is installed but is not authenticated. Follow the{' '}
                <a
                  href="https://cli.github.com/manual/gh_auth_login"
                  rel="noreferrer"
                  target="_blank">
                  GitHub CLI login guide
                </a>
                , then run:
              </p>
              <pre>
                <code>gh auth login -h github.com -s delete_repo --web</code>
              </pre>
            </>
          ) : (
            <>
              <p>
                Signed in as <strong>@{status.gh.username}</strong>, but
                repository deletion permission is missing. See the{' '}
                <a
                  href="https://cli.github.com/manual/gh_auth_refresh"
                  rel="noreferrer"
                  target="_blank">
                  GitHub CLI permission guide
                </a>
                , then run:
              </p>
              <pre>
                <code>gh auth refresh -h github.com -s delete_repo</code>
              </pre>
            </>
          )}
          <button
            className="button button-primary"
            onClick={() => void onCheckAgain()}
            type="button">
            Check again
          </button>
        </article>

        <article className="card setup-card">
          <span className="option-badge">Alternative</span>
          <div className="card-heading">
            <span className="option-number" aria-hidden="true">
              2
            </span>
            <h3>Use an access token</h3>
          </div>
          <p>
            Your token is sent only to this local server and kept in memory
            until you stop the app.
          </p>
          <form
            className="token-form"
            onSubmit={(event) => void handleSubmit(event)}>
            <label htmlFor="token">GitHub access token</label>
            <input
              autoComplete="off"
              id="token"
              onChange={(event) => setToken(event.target.value)}
              placeholder="github_pat_…"
              spellCheck={false}
              type="password"
              value={token}
            />
            <button
              className="button button-secondary"
              disabled={saving || token.trim() === ''}
              type="submit">
              {saving ? 'Validating…' : 'Use token'}
            </button>
          </form>
          <p className="fine-print">
            The token needs repository metadata access and Administration write
            access for each repository it may delete.
          </p>
        </article>
      </div>
    </section>
  );
}
