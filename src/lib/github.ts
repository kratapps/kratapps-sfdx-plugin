import fetch from "node-fetch";
import { Many } from "@salesforce/ts-types/lib/types/union";
import { isString } from "@salesforce/ts-types";

export const acceptHeader: { [key: string]: Accept } = {
  raw: 'application/vnd.github.v3.raw+json',
  json: 'application/vnd.github.v3.json'
};

export type Accept =
  'application/vnd.github.v3.raw+json' |
  'application/vnd.github.v3.json';

export type StructuredFileLocation = {
  owner: string;
  repo: string;
  path: string;
}

export type GetRepositoryContentOptions = {
  target: StructuredFileLocation | string;
  accept: Accept;
  token?: string;
}

export type GithubContent = {
  name: string;
  path: string;
  download_url: string | null;
  url: string;
  type: 'file' | 'dir';
}

export function isGithubContent(it: unknown): it is GithubContent {
  return (it as GithubContent).name !== undefined;
}

export async function getRepositoryContent(opts: GetRepositoryContentOptions)
  : Promise<Many<GithubContent> | string> {
  const { target, accept, token } = opts;
  const url = isString(target)
    ? target
    : `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${target.path}`;
  const resp = await fetch(url, {
      headers: {
        accept,
        Authorization: token ? `token ${token}` : undefined,
      }
    },
  );
  if (resp.status === 404) {
    throw new Error(`resource not found at: ${url}`);
  } else if (resp.status !== 200) {
    throw new Error(await resp.text());
  }
  return accept === acceptHeader.raw ? resp.text() : resp.json();
}
