import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, isArray } from '@salesforce/ts-types';
import { dirSync } from 'tmp';
import { outputFileSync } from 'fs-extra';
import { join } from "path";
import { UX } from "@salesforce/command/lib/ux";
import { cmd } from '../../../../lib/command';
import { acceptJson, acceptRaw, getRepositoryContent, isGithubContent } from "../../../../lib/github";
import rimraf = require('rimraf');

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('kratapps-sfdx-plugin', 'remoteSourceDeploy');
const KRATAPPS_GH_ACCESS_TOKEN = process.env.KRATAPPS_GH_ACCESS_TOKEN;

type Service = "github";

type GithubContent = {
  name: string;
  path: string;
  download_url: string | null;
  type: 'file' | 'dir';
}

export default class Org extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx kratapps:remote:source:deploy --targetusername myOrg@example.com --sourcepath /kratapps/lwc-library/src/main/default/lwc
  `
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    service: flags.enum<Service>({
      char: 's',
      description: messages.getMessage('serviceFlagDescription'),
      options: ['github'],
      default: 'github',
      required: true
    }),
    sourcepath: flags.string({
      char: 'p',
      description: messages.getMessage('sourcepathFlagDescription'),
      required: true
    })
  };

  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    const { sourcepath, service, targetusername } = this.flags;
    const sourcePathParts: string[] = sourcepath.replace(/^(\/)/, "").split('/');
    if (sourcePathParts.length < 3) {
      throw new SfdxError(`Invalid source path: ${sourcepath}`);
    }
    const [owner, repo] = sourcePathParts;
    const path = sourcePathParts.slice(2).join('/');
    this.ux.startSpinner(`loading source from ${service}`);
    const { name: tmpDir } = dirSync();
    this.ux.startSpinner(`loading source from ${service}`);
    await retrieveSource(this.ux, tmpDir, owner, repo, path);
    this.ux.stopSpinner();
    const sfdx = await cmd('sfdx', {
      cwd: tmpDir,
      printCommand: false
    });
    await sfdx.exec(['force:source:deploy', {
      sourcepath: path,
      targetusername
    }]);
    rimraf.sync(tmpDir);
    return {};
  }
}

async function retrieveSource(ux: UX, dir: string, owner: string, repo: string, path: string) {
  ux.log(`loading source: sfdx-project.json`);
  await retrieveFromGithubRecursive(dir, `https://api.github.com/repos/${owner}/${repo}/contents`, 'sfdx-project.json');
  try {
    ux.log(`loading source: .forceignore`);
    await retrieveFromGithubRecursive(dir, `https://api.github.com/repos/${owner}/${repo}/contents`, '.forceignore');
  } catch (ignored) {
    ux.log('.forceignore not found');
  }
  ux.log(`loading source: ${path}`);
  await retrieveFromGithubRecursive(dir, `https://api.github.com/repos/${owner}/${repo}/contents`, path);
}

async function processItem(baseDir: string, content: GithubContent, baseUrl: string) {
  const { type, path, download_url: downloadUrl } = content;
  if (type === 'file' && downloadUrl) {
    // file
    await saveFileFromGithub(join(baseDir, path), downloadUrl);
  } else if (type === 'dir') {
    // dir
    retrieveFromGithubRecursive(baseDir, baseUrl, path);
  }
}

async function saveFileFromGithub(path: string, url: string) {
  const data = await getRepositoryContent({
    target: url,
    accept: acceptRaw,
    token: KRATAPPS_GH_ACCESS_TOKEN
  });
  return outputFileSync(path, data);
}

async function retrieveFromGithubRecursive(baseDir: string, baseUrl: string, path: string) {
  const url = `${baseUrl}/${path}`;
  const content = await getRepositoryContent({
    target: url,
    accept: acceptJson,
    token: KRATAPPS_GH_ACCESS_TOKEN
  });
  if (isGithubContent(content)) {
    processItem(baseDir, content, baseUrl);
  } else if (isArray<GithubContent>(content)) {
    for (const item of content) {
      processItem(baseDir, item, baseUrl);
    }
  }
}
