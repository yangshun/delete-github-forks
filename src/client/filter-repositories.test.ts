import { describe, expect, it } from 'vitest';

import type { Repository } from '../shared/types';
import { filterRepositories } from './filter-repositories';

const now = new Date('2026-07-12T00:00:00Z').getTime();
const repositories: Array<Repository> = [
  {
    archived: false,
    fullName: 'octocat/recent-public',
    openPullRequestCount: 0,
    openPullRequests: [],
    pullRequestStatus: 'loaded',
    private: false,
    pushedAt: '2026-06-01T00:00:00Z',
    url: 'https://github.com/octocat/recent-public',
  },
  {
    archived: true,
    fullName: 'octocat/old-private',
    openPullRequestCount: 1,
    openPullRequests: [
      {
        title: 'Keep this fork',
        url: 'https://github.com/upstream/repo/pull/1',
      },
    ],
    pullRequestStatus: 'loaded',
    private: true,
    pushedAt: '2023-01-01T00:00:00Z',
    url: 'https://github.com/octocat/old-private',
  },
];

describe('filterRepositories', () => {
  it('filters by name and visibility', () => {
    expect(
      filterRepositories(repositories, {
        age: 'all',
        now,
        search: 'OLD',
        visibility: 'private',
      }).map((repository) => repository.fullName),
    ).toEqual(['octocat/old-private']);
  });

  it('filters by inactivity age', () => {
    expect(
      filterRepositories(repositories, {
        age: '2',
        now,
        search: '',
        visibility: 'all',
      }).map((repository) => repository.fullName),
    ).toEqual(['octocat/old-private']);
  });
});
