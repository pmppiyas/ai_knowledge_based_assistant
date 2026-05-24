export interface IGithubDoc {
  pageContent: string;
  metadata: {
    type: string;
    repo: string;
    file: string;
  };
}
