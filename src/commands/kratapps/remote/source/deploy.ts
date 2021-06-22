import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, isArray, Optional } from '@salesforce/ts-types';
import { dirSync } from 'tmp';
import { outputFileSync } from 'fs-extra';
import { join } from "path";
import { UX } from "@salesforce/command/lib/ux";
import { cmd } from '../../../../lib/command';
import {
  acceptJson,
  acceptRaw,
  getRepositoryContent, GithubContent,
  isGithubContent,
  StructuredFileLocation
} from "../../../../lib/github";
import rimraf = require('rimraf');

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('kratapps-sfdx-plugin', 'remoteSourceDeploy');
const KRATAPPS_GH_ACCESS_TOKEN = process.env.KRATAPPS_GH_ACCESS_TOKEN;

type Service = "github";

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
    }),
    token: flags.string({
      char: 't',
      description: messages.getMessage('tokenFlagDescription'),
    })
  };

  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    const { sourcepath, service, targetusername, token = KRATAPPS_GH_ACCESS_TOKEN } = this.flags;
    const sourcePathParts: string[] = sourcepath.replace(/^(\/)/, "").split('/');
    if (sourcePathParts.length < 3) {
      throw new SfdxError(`Invalid source path: ${sourcepath}`);
    }
    const [owner, repo] = sourcePathParts;
    const path = sourcePathParts.slice(2).join('/');
    this.ux.startSpinner(`loading source from ${service}`);
    const { name: tmpDir } = dirSync();
    this.ux.startSpinner(`loading source from ${service}`);
    await retrieveSource(this.ux, tmpDir, owner, repo, path, token);
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

async function retrieveSource(ux: UX, dir: string, owner: string, repo: string, path: string, token: Optional<string>) {
  ux.log(`loading source: sfdx-project.json`);
  await retrieveFromGithubRecursive(dir, { owner, repo, path: 'sfdx-project.json' }, token);
  try {
    ux.log(`loading source: .forceignore`);
    await retrieveFromGithubRecursive(dir, { owner, repo, path: '.forceignore' }, token);
  } catch (ignored) {
    ux.log('.forceignore not found');
  }
  ux.log(`loading source: ${path}`);
  await retrieveFromGithubRecursive(dir, { owner, repo, path }, token);
}

async function processItem(baseDir: string, content: GithubContent, target: StructuredFileLocation | string, token: Optional<string>) {
  const promises = [];
  const { type, path, url, download_url: downloadUrl } = content;
  if (type === 'file' && downloadUrl) {
    promises.push(saveFileFromGithub(join(baseDir, path), downloadUrl, token));
  } else if (type === 'dir') {
    promises.push(retrieveFromGithubRecursive(baseDir, url, token));
  }
  return Promise.all(promises);
}

async function saveFileFromGithub(path: string, target: StructuredFileLocation | string, token: Optional<string>) {
  const data = await getRepositoryContent({
    target,
    accept: acceptRaw,
    token
  });
  return outputFileSync(path, data);
}

async function retrieveFromGithubRecursive(baseDir: string, target: StructuredFileLocation | string, token: Optional<string>) {
  const promises = [];
  const content = await getRepositoryContent({
    target,
    accept: acceptJson,
    token
  });
  if (isGithubContent(content)) {
    promises.push(processItem(baseDir, content, target, token));
  } else if (isArray<GithubContent>(content)) {
    for (const item of content) {
      promises.push(processItem(baseDir, item, target, token));
    }
  }
  return Promise.all(promises);
}
