import { useState } from 'react';

import type { DeleteResult, Repository } from '../../shared/types';

type DeleteDialogProps = {
  deleting: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  progress: { complete: number; total: number };
  repositories: Array<Repository>;
  results: Array<DeleteResult>;
};

function protectionReason(repository: Repository): string {
  const reasons: Array<string> = [];

  if (repository.pullRequestStatus !== 'loaded') {
    reasons.push('PR status unknown');
  } else if ((repository.openPullRequestCount ?? 0) > 0) {
    reasons.push(`${repository.openPullRequestCount} open PR(s)`);
  }

  if (repository.forkStatus !== 'loaded') {
    reasons.push('fork status unknown');
  } else {
    if ((repository.aheadBy ?? 0) > 0) {
      reasons.push(`${repository.aheadBy} commit(s) ahead of upstream`);
    }
    if ((repository.extraBranchCount ?? 0) > 0) {
      reasons.push(`${repository.extraBranchCount} other branch(es)`);
    }
  }

  return reasons.join(', ');
}

export function DeleteDialog({
  deleting,
  onClose,
  onDelete,
  progress,
  repositories,
  results,
}: DeleteDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const completed = results.length > 0 && !deleting;
  const protectedRepositories = repositories.filter(
    (repository) =>
      repository.pullRequestStatus !== 'loaded' ||
      (repository.openPullRequestCount ?? 0) > 0 ||
      repository.forkStatus !== 'loaded' ||
      (repository.aheadBy ?? 0) > 0 ||
      (repository.extraBranchCount ?? 0) > 0,
  );

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose();
      }}>
      <section
        aria-labelledby="delete-title"
        aria-modal="true"
        className="dialog"
        role="dialog">
        {completed ? (
          <>
            <h2 id="delete-title">Deletion complete</h2>
            <p>
              {results.filter((result) => result.success).length} succeeded,{' '}
              {results.filter((result) => !result.success).length} failed.
            </p>
            <ul className="result-list">
              {results.map((result) => (
                <li
                  className={result.success ? 'result-success' : 'result-error'}
                  key={result.name}>
                  <strong>{result.name}</strong>
                  <span>{result.success ? 'Deleted' : result.error}</span>
                </li>
              ))}
            </ul>
            <div className="dialog-actions">
              <button
                className="button button-primary"
                onClick={onClose}
                type="button">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="danger-icon">
              !
            </span>
            <h2 id="delete-title">
              Delete {repositories.length} repositories?
            </h2>
            <p>
              This cannot be undone. These exact repositories will be deleted:
            </p>
            <ul className="review-list">
              {repositories.map((repository) => (
                <li key={repository.fullName}>{repository.fullName}</li>
              ))}
            </ul>
            {protectedRepositories.length > 0 ? (
              <div className="pr-warning" role="alert">
                <strong>Unsafe to delete</strong>
                <p>
                  These forks have open pull requests, commits or branches
                  that haven&rsquo;t been merged upstream, or could not be
                  checked. Deleting them may disrupt active contributions or
                  discard unmerged work.
                </p>
                <ul>
                  {protectedRepositories.map((repository) => (
                    <li key={repository.fullName}>
                      {repository.fullName}: {protectionReason(repository)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {deleting ? (
              <>
                <progress
                  className="progress-track"
                  max={progress.total}
                  value={progress.complete}
                />
                <p className="progress-label">
                  Deleted {progress.complete} of {progress.total}
                </p>
              </>
            ) : (
              <>
                <label htmlFor="confirmation">
                  Type <strong>DELETE</strong> to confirm
                </label>
                <input
                  autoComplete="off"
                  className="confirmation-input"
                  id="confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  value={confirmation}
                />
                <div className="dialog-actions">
                  <button
                    className="button button-secondary"
                    onClick={onClose}
                    type="button">
                    Cancel
                  </button>
                  <button
                    className="button button-danger"
                    disabled={confirmation !== 'DELETE'}
                    onClick={() => void onDelete()}
                    type="button">
                    Permanently delete
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
