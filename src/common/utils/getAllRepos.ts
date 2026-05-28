import { ENV } from 'src/common/config/env.config';

export const getAllRepos = async (owner: string): Promise<any[]> => {
  let page = 1;

  const allRepos: any[] = [];

  while (true) {
    if (page > 10) break;

    const res = await fetch(
      `https://api.github.com/users/${owner}/repos?page=${page}&sort=updated`,
      {
        headers: {
          Authorization: `token ${ENV.GITHUB_TOKEN}`,
        },
      },
    );

    if (!res.ok) break;
    const repos = await res.json();

    if (!repos.length) break;

    allRepos.push(...repos);
    page++;
  }

  return allRepos;
};
