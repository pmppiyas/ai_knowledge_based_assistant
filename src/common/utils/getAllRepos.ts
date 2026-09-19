import { ENV } from 'src/common/config/env.config';

export const getAllRepos = async (owner: string): Promise<any[]> => {
  let page = 1;
  const allRepos: any[] = [];

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PrinceMahmudPiyas-Portfolio-Assistant',
  };

  if (ENV.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${ENV.GITHUB_TOKEN}`;
  }

  let activeHeaders = { ...headers };

  while (page <= 5) {
    try {
      let url = `https://api.github.com/user/repos?page=${page}&per_page=100&sort=updated&affiliation=owner`;
      let res = await fetch(url, { headers: activeHeaders });

      // If token is invalid/expired (401 Bad credentials), strip Authorization and fallback to public repos
      if (res.status === 401 && activeHeaders.Authorization) {
        console.warn(
          `[GitHub Token Warning] Token returned 401 Unauthorized (expired or invalid). Continuing with public access for ${owner}...`,
        );
        delete activeHeaders.Authorization;
        url = `https://api.github.com/users/${owner}/repos?page=${page}&per_page=100&sort=updated`;
        res = await fetch(url, { headers: activeHeaders });
      } else if (!res.ok) {
        url = `https://api.github.com/users/${owner}/repos?page=${page}&per_page=100&sort=updated`;
        res = await fetch(url, { headers: activeHeaders });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error(
          `[GitHub API Error] Failed to fetch repos for ${owner} (Page ${page}): HTTP ${res.status} - ${errorText}`,
        );
        break;
      }

      const repos = await res.json();
      if (!Array.isArray(repos) || repos.length === 0) {
        break;
      }

      allRepos.push(...repos);
      page++;
    } catch (err: any) {
      console.error(
        `[GitHub API Network Error] Page ${page}:`,
        err?.message || err,
      );
      break;
    }
  }

  console.log(
    `[GitHub API] Fetched total ${allRepos.length} repos for ${owner}`,
  );
  return allRepos;
};
