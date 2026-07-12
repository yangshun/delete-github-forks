import type { Repository } from '../../shared/types';

type RepositoryTableProps = {
  allVisibleSelected: boolean;
  loading: boolean;
  onToggleRepository: (fullName: string) => void;
  onToggleVisible: () => void;
  repositories: Array<Repository>;
  selected: Set<string>;
  totalCount: number;
};

function formatDate(value: string | null): string {
  if (value == null) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export function RepositoryTable({
  allVisibleSelected,
  loading,
  onToggleRepository,
  onToggleVisible,
  repositories,
  selected,
  totalCount,
}: RepositoryTableProps) {
  if (loading) {
    return (
      <div aria-live="polite" className="empty-state">
        <span aria-hidden="true" className="spinner" />
        Fetching every fork…
      </div>
    );
  }
  if (totalCount === 0) {
    return (
      <div className="empty-state">
        <h3>No forks found</h3>
        <p>Your account does not have any forked repositories to clean up.</p>
      </div>
    );
  }
  if (repositories.length === 0) {
    return (
      <div className="empty-state">
        <h3>No matching forks</h3>
        <p>Try changing your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="check-cell">
              <input
                aria-label="Select all safe visible repositories"
                checked={allVisibleSelected}
                onChange={onToggleVisible}
                title="Select visible repositories without open pull request warnings"
                type="checkbox"
              />
            </th>
            <th>Repository</th>
            <th>Visibility</th>
            <th>Open PRs</th>
            <th>Last pushed</th>
          </tr>
        </thead>
        <tbody>
          {repositories.map((repository) => (
            <tr
              className={
                selected.has(repository.fullName) ? 'selected' : undefined
              }
              key={repository.fullName}>
              <td className="check-cell">
                <input
                  aria-label={`Select ${repository.fullName}`}
                  checked={selected.has(repository.fullName)}
                  onChange={() => onToggleRepository(repository.fullName)}
                  type="checkbox"
                />
              </td>
              <td>
                <a href={repository.url} rel="noreferrer" target="_blank">
                  {repository.fullName}
                </a>
                {repository.archived ? (
                  <span className="badge">Archived</span>
                ) : null}
              </td>
              <td>
                <span className="visibility-badge">
                  {repository.private ? 'Private' : 'Public'}
                </span>
              </td>
              <td>
                {repository.pullRequestStatus === 'loading' ? (
                  <span
                    className="pr-loading"
                    aria-label="Checking open pull requests">
                    <span
                      aria-hidden="true"
                      className="spinner spinner-small"
                    />
                    Checking
                  </span>
                ) : repository.pullRequestStatus === 'unavailable' ? (
                  <span className="pr-status pr-status-unknown">Unknown</span>
                ) : repository.openPullRequestCount === 0 ? (
                  <span className="muted">None</span>
                ) : (
                  <span className="pr-links">
                    <strong>{repository.openPullRequestCount} open</strong>
                    {repository.openPullRequests
                      .slice(0, 3)
                      .map((pullRequest, index) => (
                        <a
                          aria-label={pullRequest.title}
                          href={pullRequest.url}
                          key={pullRequest.url}
                          rel="noreferrer"
                          target="_blank"
                          title={pullRequest.title}>
                          {index + 1}
                        </a>
                      ))}
                  </span>
                )}
              </td>
              <td className="muted">{formatDate(repository.pushedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
