import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { AppStatus, DeleteResult, Repository } from '../shared/types';
import { api } from './api';
import { AuthSetup } from './components/AuthSetup';
import { DeleteDialog } from './components/DeleteDialog';
import { RepositoryTable } from './components/RepositoryTable';
import {
  filterRepositories,
  type AgeFilter,
  type VisibilityFilter,
} from './filter-repositories';

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [repositories, setRepositories] = useState<Array<Repository>>([]);
  const [selected, setSelected] = useState(() => new Set<string>());
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [age, setAge] = useState<AgeFilter>('all');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({
    complete: 0,
    total: 0,
  });
  const [deleteResults, setDeleteResults] = useState<Array<DeleteResult>>([]);
  const pullRequestGeneration = useRef(0);

  const loadPullRequestData = useCallback(
    async (pendingRepositories: Array<Repository>, generation: number) => {
      for (let offset = 0; offset < pendingRepositories.length; offset += 10) {
        const batch = pendingRepositories.slice(offset, offset + 10);
        let updates: Array<Repository>;
        try {
          updates = await api.getPullRequestData(
            batch.map((repository) => repository.fullName),
          );
        } catch {
          updates = batch.map((repository) => ({
            ...repository,
            pullRequestStatus: 'unavailable' as const,
          }));
        }

        if (pullRequestGeneration.current !== generation) return;
        const updatesByName = new Map(
          updates.map((repository) => [repository.fullName, repository]),
        );
        setRepositories((current) =>
          current.map(
            (repository) =>
              updatesByName.get(repository.fullName) ?? repository,
          ),
        );
      }
    },
    [],
  );

  const loadRepositories = useCallback(async () => {
    const generation = ++pullRequestGeneration.current;
    setLoadingRepositories(true);
    setErrorMessage('');
    try {
      const nextRepositories = await api.getRepositories();
      setRepositories(nextRepositories);
      setSelected(new Set());
      void loadPullRequestData(nextRepositories, generation);
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setLoadingRepositories(false);
    }
  }, [loadPullRequestData]);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setErrorMessage('');
    try {
      const nextStatus = await api.getStatus();
      setStatus(nextStatus);
      if (nextStatus.activeMode != null) await loadRepositories();
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setLoadingStatus(false);
    }
  }, [loadRepositories]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const filteredRepositories = useMemo(() => {
    return filterRepositories(repositories, {
      age,
      now: Date.now(),
      search: deferredSearch,
      visibility,
    });
  }, [age, deferredSearch, repositories, visibility]);

  const selectedRepositories = useMemo(
    () =>
      repositories.filter((repository) => selected.has(repository.fullName)),
    [repositories, selected],
  );
  const bulkSelectableRepositories = filteredRepositories.filter(
    (repository) =>
      repository.pullRequestStatus === 'loaded' &&
      repository.openPullRequestCount === 0,
  );
  const allVisibleSelected =
    bulkSelectableRepositories.length > 0 &&
    bulkSelectableRepositories.every((repository) =>
      selected.has(repository.fullName),
    );

  const toggleRepository = useCallback((fullName: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }, []);

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const repository of bulkSelectableRepositories) {
        if (allVisibleSelected) next.delete(repository.fullName);
        else next.add(repository.fullName);
      }
      return next;
    });
  }

  async function submitToken(token: string) {
    setErrorMessage('');
    try {
      const nextStatus = await api.setToken(token);
      setStatus(nextStatus);
      await loadRepositories();
    } catch (error) {
      setErrorMessage(errorText(error));
      throw error;
    }
  }

  async function clearToken() {
    pullRequestGeneration.current++;
    setStatus(await api.clearToken());
    setRepositories([]);
    setSelected(new Set());
  }

  function openDeleteDialog() {
    setDeleteResults([]);
    setShowDeleteDialog(true);
  }

  async function deleteSelected() {
    const names = selectedRepositories.map((repository) => repository.fullName);
    setDeleting(true);
    setDeleteProgress({ complete: 0, total: names.length });
    setDeleteResults([]);
    for (const name of names) {
      let result: DeleteResult;
      try {
        [result] = await api.deleteRepositories([name]);
      } catch (error) {
        result = { error: errorText(error), name, success: false };
      }
      setDeleteResults((current) => [...current, result]);
      setDeleteProgress((current) => ({
        ...current,
        complete: current.complete + 1,
      }));
      if (result.success) {
        setRepositories((current) =>
          current.filter((repository) => repository.fullName !== name),
        );
        setSelected((current) => {
          const next = new Set(current);
          next.delete(name);
          return next;
        });
      }
    }
    setDeleting(false);
  }

  return (
    <main className="shell">
      <header className="hero">
        <h1>Clean up your GitHub forks</h1>
        <p>
          Review every fork in one place, filter the noise, and delete only what
          you explicitly select. Everything runs on this computer.
        </p>
      </header>

      {errorMessage ? (
        <div className="alert alert-error" role="alert">
          <strong>Something went wrong</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {loadingStatus ? (
        <section aria-live="polite" className="card loading-card">
          <span aria-hidden="true" className="spinner" />
          Checking your GitHub setup…
        </section>
      ) : status?.activeMode == null && status != null ? (
        <AuthSetup
          onCheckAgain={loadStatus}
          onSubmitToken={submitToken}
          status={status}
        />
      ) : status != null ? (
        <section className="workspace">
          <div className="card account-bar">
            <div>
              <span aria-hidden="true" className="status-dot" />
              <strong>
                {status.activeMode === 'gh' ? 'GitHub CLI' : 'Access token'}
              </strong>
              <span className="muted">
                {' '}
                · @
                {status.activeMode === 'gh'
                  ? status.gh.username
                  : status.tokenUsername}
              </span>
            </div>
            <div className="account-actions">
              {status.activeMode === 'token' ? (
                <button
                  className="text-button"
                  onClick={() => void clearToken()}
                  type="button">
                  Remove token
                </button>
              ) : null}
              <button
                className="text-button"
                onClick={() => void loadRepositories()}
                type="button">
                Refresh
              </button>
            </div>
          </div>
          <div className="workspace-heading">
            <div>
              <h2>Your forks</h2>
              <p>{repositories.length} repositories available to review</p>
            </div>
            <button
              className="button button-danger"
              disabled={selected.size === 0}
              onClick={openDeleteDialog}
              type="button">
              Delete selected {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
          <div className="card repository-card">
            <div className="filters">
              <label>
                <span className="sr-only">Search repositories</span>
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search forks…"
                  type="search"
                  value={search}
                />
              </label>
              <label>
                <span className="sr-only">Visibility</span>
                <select
                  onChange={(event) =>
                    setVisibility(event.target.value as VisibilityFilter)
                  }
                  value={visibility}>
                  <option value="all">All visibility</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Last pushed</span>
                <select
                  onChange={(event) => setAge(event.target.value as AgeFilter)}
                  value={age}>
                  <option value="all">Any activity</option>
                  <option value="0.5">Inactive 6+ months</option>
                  <option value="1">Inactive 1+ year</option>
                  <option value="2">Inactive 2+ years</option>
                  <option value="5">Inactive 5+ years</option>
                </select>
              </label>
            </div>
            <RepositoryTable
              allVisibleSelected={allVisibleSelected}
              loading={loadingRepositories}
              onToggleRepository={toggleRepository}
              onToggleVisible={toggleVisible}
              repositories={filteredRepositories}
              selected={selected}
              totalCount={repositories.length}
            />
          </div>
        </section>
      ) : null}

      {showDeleteDialog ? (
        <DeleteDialog
          deleting={deleting}
          onClose={() => {
            if (!deleting) setShowDeleteDialog(false);
          }}
          onDelete={deleteSelected}
          progress={deleteProgress}
          repositories={selectedRepositories}
          results={deleteResults}
        />
      ) : null}
    </main>
  );
}
