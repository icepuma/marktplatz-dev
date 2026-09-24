export type GithubLicenseResponse = {
  license: { spdx_id: string | null } | null;
  content: string;
  encoding: string;
};

export type RepoLicense = { spdx: string; text: string };

/** Turns the GitHub license API response into a license, or throws if it isn't a recognized one. */
export function evaluateLicense(response: GithubLicenseResponse | null): RepoLicense {
  if (!response) throw new Error("repo has no license");
  const spdx = response.license?.spdx_id;
  if (!spdx || spdx === "NOASSERTION") throw new Error("repo license is not a recognized SPDX license");
  if (response.encoding !== "base64") throw new Error(`unexpected license encoding: ${response.encoding}`);
  return { spdx, text: Buffer.from(response.content, "base64").toString("utf8") };
}

/** Reads the repo license at an exact commit via `GET /repos/{repo}/license?ref={sha}`. */
export async function fetchRepoLicense(repo: string, sha: string, token?: string): Promise<RepoLicense> {
  const res = await fetch(`https://api.github.com/repos/${repo}/license?ref=${sha}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return evaluateLicense(null);
  if (!res.ok) throw new Error(`GitHub license API returned ${res.status}`);
  return evaluateLicense((await res.json()) as GithubLicenseResponse);
}
