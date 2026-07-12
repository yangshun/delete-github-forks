import type { Repository } from '../shared/types';

export type VisibilityFilter = 'all' | 'private' | 'public';
export type AgeFilter = 'all' | '0.5' | '1' | '2' | '5';

type RepositoryFilters = {
  age: AgeFilter;
  now: number;
  search: string;
  visibility: VisibilityFilter;
};

export function filterRepositories(
  repositories: Array<Repository>,
  filters: RepositoryFilters,
): Array<Repository> {
  const query = filters.search.trim().toLowerCase();
  const years = filters.age === 'all' ? null : Number(filters.age);
  const cutoff =
    years == null ? null : filters.now - years * 365.25 * 24 * 60 * 60 * 1000;

  return repositories.filter((repository) => {
    if (query !== '' && !repository.fullName.toLowerCase().includes(query)) {
      return false;
    }
    if (filters.visibility === 'private' && !repository.private) return false;
    if (filters.visibility === 'public' && repository.private) return false;
    if (cutoff != null) {
      const pushedAt = repository.pushedAt
        ? new Date(repository.pushedAt).getTime()
        : 0;
      if (pushedAt >= cutoff) return false;
    }
    return true;
  });
}
