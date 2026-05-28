import { ENV } from 'src/common/config/env.config';

export const getLatestCommitSHA = async (owner: string, repo: string) => {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
    {
      headers: {
        Authorization: `token ${ENV.GITHUB_TOKEN}`,
      },
    },
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data?.[0]?.sha || null;
};
