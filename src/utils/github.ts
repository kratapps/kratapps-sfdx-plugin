import fetch from 'node-fetch';

import { Optional, ensure, isString } from '@salesforce/ts-types';
import { Many } from '@salesforce/ts-types/lib/types/union';

export const acceptHeader: { [key: string]: Accept } = {
    raw: 'application/vnd.github.v3.raw+json',
    json: 'application/vnd.github.v3.json'
};

export type Accept = 'application/vnd.github.v3.raw+json' | 'application/vnd.github.v3.json';

export type StructuredFileLocation = {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
};

export type GetRepositoryContentOptions = {
    target: StructuredFileLocation | string;
    accept: Accept;
    token?: string;
};

export type RepositoryContent = {
    name: string;
    path: string;
    download_url: string | null;
    url: string;
    type: 'file' | 'dir';
};

export function ensureRepositoryContent(value: unknown): RepositoryContent {
    return ensure(asRepositoryContent(value), 'Value is not a RepositoryContent');
}

export function asRepositoryContent(value: unknown, defaultValue?: RepositoryContent): Optional<RepositoryContent> {
    return isRepositoryContent(value) ? value : defaultValue;
}

export function isRepositoryContent(it: unknown): it is RepositoryContent {
    return (it as RepositoryContent).name !== undefined;
}

export async function getRepositoryContent(opts: GetRepositoryContentOptions): Promise<Many<RepositoryContent> | string> {
    const { target, accept, token } = opts;
    const refQuery = (ref: Optional<string>): string => (ref ? `ref=${ref}` : '');
    const url = isString(target)
        ? target
        : `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${target.path}?${refQuery(target.ref)}`;
    const resp = await fetch(url, {
        headers: {
            accept,
            Authorization: token ? `token ${token}` : ''
        }
    });
    if (resp.status === 404) {
        throw new Error(`resource not found at: ${url}`);
    } else if (resp.status !== 200) {
        throw new Error(await resp.text());
    }
    return accept === acceptHeader.raw ? resp.text() : ensureRepositoryContent(resp.json());
}
