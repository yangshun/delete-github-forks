export type AuthMode = 'gh' | 'token' | null;

export type GhStatus = {
  authenticated: boolean;
  error?: string;
  hasDeleteScope: boolean;
  installed: boolean;
  username?: string;
};

export type AppStatus = {
  activeMode: AuthMode;
  gh: GhStatus;
  tokenUsername?: string;
};

export type Repository = {
  archived: boolean;
  fullName: string;
  openPullRequestCount: number | null;
  openPullRequests: Array<{
    title: string;
    url: string;
  }>;
  pullRequestStatus: 'loading' | 'loaded' | 'unavailable';
  private: boolean;
  pushedAt: string | null;
  url: string;
};

export type DeleteResult = {
  error?: string;
  name: string;
  success: boolean;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
