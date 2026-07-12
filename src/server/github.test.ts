// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { Repository } from '../shared/types';
import type { GraphQLExecutor } from './github';
import { enrichPullRequests, getActiveMode } from './github';

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
    const repositories: Array<Repository> = [
      {
        archived: false,
        fullName: 'octocat/fork',
        openPullRequestCount: null,
        openPullRequests: [],
        pullRequestStatus: 'loading',
        private: false,
        pushedAt: null,
        url: 'https://github.com/octocat/fork',
      },
    ];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: {
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
              },
            ],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      } as T,
    });

    const result = await enrichPullRequests(repositories, execute);
    expect(result[0].openPullRequestCount).toBe(1);
    expect(result[0].openPullRequests).toHaveLength(1);
  });

  it('keeps partial data when one repository cannot be resolved', async () => {
    const repository = (fullName: string): Repository => ({
      archived: false,
      fullName,
      openPullRequestCount: null,
      openPullRequests: [],
      pullRequestStatus: 'loading',
      private: false,
      pushedAt: null,
      url: `https://github.com/${fullName}`,
    });
    const repositories = [
      repository('octocat/blocked'),
      repository('octocat/available'),
    ];
    const execute: GraphQLExecutor = async <T>() => ({
      data: {
        r0: null,
        r1: {
          refs: {
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        },
      } as T,
      errors: [{ message: 'Could not resolve blocked repository' }],
    });

    const result = await enrichPullRequests(repositories, execute);
    expect(result[0].openPullRequestCount).toBeNull();
    expect(result[1].openPullRequestCount).toBe(0);
  });
});
