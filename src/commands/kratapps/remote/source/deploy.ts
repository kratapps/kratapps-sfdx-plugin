import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, isArray, Optional } from '@salesforce/ts-types';
import { dirSync } from 'tmp';
import { outputFileSync } from 'fs-extra';
import { join } from "path";
import { cmd } from 'lib/command';
import {
  acceptHeader,
  getRepositoryContent,
  GithubContent,
  isGithubContent,
  StructuredFileLocation
} from "lib/github";
import rimraf = require('rimraf');

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('@kratapps/sfdx-plugin', 'remoteSourceDeploy');

export default class RemoteSourceDeploy extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx kratapps:remote:source:deploy --targetusername myOrg@example.com --sourcepath /kratapps/lwc-library/src/main/default/lwc
  `
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
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
    const { sourcepath, targetusername } = this.flags;
    const token = this.flags.token || process.env.KRATAPPS_GH_ACCESS_TOKEN || undefined;
    const sourcePathParts: string[] = sourcepath.replace(/^(\/)/, "").split('/');
    if (sourcePathParts.length < 3) {
      throw new SfdxError(`Invalid source path: ${sourcepath}`);
    }
    const [owner, repo] = sourcePathParts;
    const path = sourcePathParts.slice(2).join('/');
    const { name: srcDir } = dirSync();
    this.ux.startSpinner(`loading source from github`);
    await this.retrieveSource(srcDir, owner, repo, path, token);
    this.ux.stopSpinner();
    const sfdx = await cmd('sfdx', {
      cwd: srcDir,
      printCommand: false
    });
    await sfdx.exec(['force:source:deploy', {
      sourcepath: path,
      targetusername
    }]);
    rimraf.sync(srcDir);
    return {};
  }

  private async retrieveSource(dir: string, owner: string, repo: string, path: string, token: Optional<string>) {
    this.ux.log(`loading source: sfdx-project.json`);
    await this.retrieveFromGithubRecursive(dir, { owner, repo, path: 'sfdx-project.json' }, token);
    try {
      this.ux.log(`loading source: .forceignore`);
      await this.retrieveFromGithubRecursive(dir, { owner, repo, path: '.forceignore' }, token);
    } catch (ignored) {
      this.ux.log('.forceignore not found');
    }
    this.ux.log(`loading source: ${path}`);
    await this.retrieveFromGithubRecursive(dir, { owner, repo, path }, token);
  }

  private async retrieveFromGithubRecursive(baseDir: string, target: StructuredFileLocation | string, token: Optional<string>) {
    const promises = [];
    const content = await getRepositoryContent({
      target,
      accept: acceptHeader.json,
      token
    });
    if (isGithubContent(content)) {
      promises.push(this.processItem(baseDir, content, token));
    } else if (isArray<GithubContent>(content)) {
      for (const item of content) {
        promises.push(this.processItem(baseDir, item, token));
      }
    }
    return Promise.all(promises);
  }

  private async processItem(baseDir: string, content: GithubContent, token: Optional<string>) {
    const promises = [];
    const { type, path, url, download_url: downloadUrl } = content;
    if (type === 'file' && downloadUrl) {
      promises.push(this.saveFileFromGithub(join(baseDir, path), downloadUrl, token));
    } else if (type === 'dir') {
      promises.push(this.retrieveFromGithubRecursive(baseDir, url, token));
    }
    return Promise.all(promises);
  }

  private async saveFileFromGithub(path: string, target: StructuredFileLocation | string, token: Optional<string>) {
    const data = await getRepositoryContent({
      target,
      accept: acceptHeader.raw,
      token
    });
    return outputFileSync(path, data);
  }
}
