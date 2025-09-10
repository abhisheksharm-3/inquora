/**
 * GitHub API Types
 */

export interface TypeGitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface TypeGitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  languages_url: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    id: number;
  };
}

export interface TypeGitHubRepositoryInfo {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  size: number;
  lastUpdate: string;
}

export interface TypeGitHubProcessResult {
  numDocs: number;
  success: boolean;
  error?: string;
}

export interface TypeGitHubParseResult {
  owner: string;
  repo: string;
}
