// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { Repository } from '../shared/types';
import type { CompareExecutor, GraphQLExecutor } from './github';
import { enrichPullRequests, getActiveMode } from './github';

function repository(fullName: string): Repository {
  return {
    aheadBy: null,
    archived: false,
    extraBranchCount: null,
    forkStatus: 'loading',
    fullName,
    openPullRequestCount: null,
    openPullRequests: [],
    pullRequestStatus: 'loading',
    private: false,
    pushedAt: null,
    url: `https://github.com/${fullName}`,
  };
}

const noCompare: CompareExecutor = async () => {
  throw new Error('compare should not be called');
};

const emptyRefs = {
  nodes: [],
  pageInfo: { endCursor: null, hasNextPage: false },
};

describe('getActiveMode', () => {
  it('prefers a fully authorized GitHub CLI session', () => {
    expect(
      getActiveMode(
        {
          authenticated: true,
          hasDeleteScope: true,
          installed: true,
          username: 'octocat',
        },
        'token-user',
      ),
    ).toBe('gh');
  });

  it('falls back to a validated token', () => {
    expect(
      getActiveMode(
        {
          authenticated: true,
          hasDeleteScope: false,
          installed: true,
          username: 'octocat',
        },
        'token-user',
      ),
    ).toBe('token');
  });
});

describe('enrichPullRequests', () => {
  it('batches repositories and records open pull requests', async () => {
    const repositories = [repository('octocat/fork')];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
          defaultBranchRef: null,
          parent: null,
          refs: {
            nodes: [
              {
                associatedPullRequests: {
                  nodes: [
                    {
                      title: 'Active contribution',
                      url: 'https://github.com/upstream/repo/pull/1',
                    },
                  ],
                  totalCount: 1,
                },
                name: 'main',
              },
            ],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      } as T,
    });

    const result = await enrichPullRequests(
      repositories,
      execute,
      noCompare,
    );
    expect(result[0].openPullRequestCount).toBe(1);
    expect(result[0].openPullRequests).toHaveLength(1);
  });

  it('keeps partial data when one repository cannot be resolved', async () => {
    const repositories = [
      repository('octocat/blocked'),
      repository('octocat/available'),
    ];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: null,
        r1: { defaultBranchRef: null, parent: null, refs: emptyRefs },
      } as T,
      errors: [{ message: 'Could not resolve blocked repository' }],
    });

    const result = await enrichPullRequests(
      repositories,
      execute,
      noCompare,
    );
    expect(result[0].openPullRequestCount).toBeNull();
    expect(result[1].openPullRequestCount).toBe(0);
  });

  it('marks a fork with no divergence as in sync without comparing', async () => {
    const repositories = [repository('octocat/fork')];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
          defaultBranchRef: { name: 'main', target: { oid: 'same-oid' } },
          parent: {
            defaultBranchRef: { name: 'main', target: { oid: 'same-oid' } },
            nameWithOwner: 'upstream/repo',
          },
          refs: emptyRefs,
        },
      } as T,
    });

    const result = await enrichPullRequests(
      repositories,
      execute,
      noCompare,
    );
    expect(result[0].forkStatus).toBe('loaded');
    expect(result[0].aheadBy).toBe(0);
  });

  it('compares diverged branches and records how far ahead the fork is', async () => {
    const repositories = [repository('octocat/fork')];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
          defaultBranchRef: { name: 'main', target: { oid: 'fork-oid' } },
          parent: {
            defaultBranchRef: { name: 'main', target: { oid: 'parent-oid' } },
            nameWithOwner: 'upstream/repo',
          },
          refs: emptyRefs,
        },
      } as T,
    });
    const compare = vi.fn(async () => ({ aheadBy: 4 }));

    const result = await enrichPullRequests(
      repositories,
      execute,
      compare,
    );
    expect(compare).toHaveBeenCalledWith(
      'octocat/fork',
      'upstream:repo:main...main',
    );
    expect(result[0].forkStatus).toBe('loaded');
    expect(result[0].aheadBy).toBe(4);
  });

  it('marks fork status unavailable when parent data is missing', async () => {
    const repositories = [repository('octocat/fork')];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
          defaultBranchRef: { name: 'main', target: { oid: 'fork-oid' } },
          parent: null,
          refs: emptyRefs,
        },
      } as T,
    });

    const result = await enrichPullRequests(
      repositories,
      execute,
      noCompare,
    );
    expect(result[0].forkStatus).toBe('unavailable');
    expect(result[0].aheadBy).toBeNull();
  });

  it('marks fork status unavailable when the compare call fails', async () => {
    const repositories = [repository('octocat/fork')];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
          defaultBranchRef: { name: 'main', target: { oid: 'fork-oid' } },
          parent: {
            defaultBranchRef: { name: 'main', target: { oid: 'parent-oid' } },
            nameWithOwner: 'upstream/repo',
          },
          refs: emptyRefs,
        },
      } as T,
    });
    const compare: CompareExecutor = async () => {
      throw new Error('rate limited');
    };

    const result = await enrichPullRequests(
      repositories,
      execute,
      compare,
    );
    expect(result[0].forkStatus).toBe('unavailable');
  });

  it('counts branches beyond the default branch', async () => {
    const repositories = [repository('octocat/fork')];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
          defaultBranchRef: { name: 'main', target: { oid: 'same-oid' } },
          parent: {
            defaultBranchRef: { name: 'main', target: { oid: 'same-oid' } },
            nameWithOwner: 'upstream/repo',
          },
          refs: {
            nodes: [
              {
                associatedPullRequests: { nodes: [], totalCount: 0 },
                name: 'main',
              },
              {
                associatedPullRequests: { nodes: [], totalCount: 0 },
                name: 'feature-a',
              },
              {
                associatedPullRequests: { nodes: [], totalCount: 0 },
                name: 'feature-b',
              },
            ],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      } as T,
    });

    const result = await enrichPullRequests(
      repositories,
      execute,
      noCompare,
    );
    expect(result[0].extraBranchCount).toBe(2);
    expect(result[0].aheadBy).toBe(0);
  });

  it('accumulates extra branch counts across paginated ref pages', async () => {
    const repositories = [repository('octocat/fork')];
    let calls = 0;
    const execute: GraphQLExecutor = async <T>(
      _query: string,
      variables: Record<string, string>,
    ) => {
      calls += 1;
      if (calls === 1) {
        return {
          data: {
            r0: {
              defaultBranchRef: { name: 'main', target: { oid: 'same-oid' } },
              parent: {
                defaultBranchRef: {
                  name: 'main',
                  target: { oid: 'same-oid' },
                },
                nameWithOwner: 'upstream/repo',
              },
              refs: {
                nodes: [
                  {
                    associatedPullRequests: { nodes: [], totalCount: 0 },
                    name: 'main',
                  },
                  {
                    associatedPullRequests: { nodes: [], totalCount: 0 },
                    name: 'feature-a',
                  },
                ],
                pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
              },
            },
          },
        } as T;
      }

      expect(variables.after).toBe('cursor-1');
      return {
        data: {
          repository: {
            refs: {
              nodes: [
                {
                  associatedPullRequests: { nodes: [], totalCount: 0 },
                  name: 'feature-b',
                },
              ],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        },
      } as T;
    };

    const result = await enrichPullRequests(
      repositories,
      execute,
      noCompare,
    );
    expect(result[0].extraBranchCount).toBe(2);
  });
});
