import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, isArray, Optional } from '@salesforce/ts-types';
import { dirSync } from 'tmp';
import { outputFileSync } from 'fs-extra';
import { join } from 'path';
import { cmd } from '../../../../lib/command';
import { acceptHeader, getRepositoryContent, GithubContent, isGithubContent, StructuredFileLocation } from '../../../../lib/github';
import rimraf = require('rimraf');

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('@kratapps/sfdx-plugin', 'remoteSourceDeploy');

export default class RemoteSourceDeploy extends SfdxCommand {
    public static description = `Deprecated. Use "kratapps remote deploy start" instead. Deploy source to an org from GitHub.`;
    public static help = `Deprecated. Use "kratapps remote deploy start" instead. Deploy source to an org from GitHub.`;

    public static examples = [
        `$ sfdx kratapps:remote:source:deploy --targetusername myOrg --source https://github.com/kratapps/component-library --sourcepath src/main/default/lwc/spinner
  `
    ];

    public static args = [];

    protected static flagsConfig = {
        sourcepath: flags.string({
            char: 'p',
            description: messages.getMessage('sourcepathFlagDescription'),
            required: true
        }),
        source: flags.string({
            char: 's',
            description: messages.getMessage('sourceFlagDescription'),
            required: true
        }),
        token: flags.string({
            char: 't',
            description: messages.getMessage('tokenFlagDescription')
        }),
        ref: flags.string({
            description: messages.getMessage('refFlagDescription')
        })
    };

    protected static requiresUsername = true;

    public async run(): Promise<AnyJson> {
        this.ux.warn('This command is deprecated, use kratapps:remote:deploy:start instead.');
        const { sourcepath, source, ref } = this.flags;
        const targetusername = this.org!.getUsername();
        const token = this.flags.token || process.env.KRATAPPS_GH_ACCESS_TOKEN || undefined;
        const sourceMatch = source.replace(/(\/)$/, '').match(new RegExp('https://(.*?)/(.*?)/(.*)'));
        if (!sourceMatch) {
            throw new SfdxError(`Invalid source: ${source}`);
        }
        const [, service, owner, repo] = sourceMatch;
        const { name: srcDir } = dirSync();
        this.ux.startSpinner(`loading source from ${service}`);
        await this.retrieveSource(srcDir, owner, repo, sourcepath.split(','), ref, token);
        this.ux.stopSpinner();
        const sfdx = cmd('sfdx', {
            cwd: srcDir,
            printCommand: true
        });
        try {
            await sfdx.exec([
                'force:source:deploy',
                {
                    sourcepath,
                    targetusername
                }
            ]);
        } catch (e) {
            throw new SfdxError('SourceDeployCommand failed');
        } finally {
            rimraf.sync(srcDir);
        }
        return {};
    }

    private async retrieveSource(
        srcDir: string,
        owner: string,
        repo: string,
        paths: string[],
        ref: Optional<string>,
        token: Optional<string>
    ) {
        this.ux.log(`loading source: sfdx-project.json`);
        await this.retrieveFromGithubRecursive(srcDir, { owner, repo, path: 'sfdx-project.json', ref }, token);
        try {
            this.ux.log(`loading source: .forceignore`);
            await this.retrieveFromGithubRecursive(srcDir, { owner, repo, path: '.forceignore', ref }, token);
        } catch (ignored) {
            this.ux.log('.forceignore not found');
        }
        for (const path of paths) {
            this.ux.log(`loading source: ${path}`);
            await this.retrieveFromGithubRecursive(srcDir, { owner, repo, path, ref }, token);
        }
    }

    private async retrieveFromGithubRecursive(
        srcDir: string,
        target: StructuredFileLocation | string,
        token: Optional<string>
    ): Promise<void> {
        const promises = [];
        const content = await getRepositoryContent({
            target,
            accept: acceptHeader.json,
            token
        });
        if (isGithubContent(content)) {
            promises.push(this.processItem(srcDir, content, token));
        } else if (isArray<GithubContent>(content)) {
            for (const item of content) {
                promises.push(this.processItem(srcDir, item, token));
            }
        }
        await Promise.all(promises);
    }

    private async processItem(srcDir: string, content: GithubContent, token: Optional<string>) {
        const { type, path, url, download_url: downloadUrl } = content;
        if (type === 'file' && downloadUrl) {
            return this.saveFileFromGithub(join(srcDir, path), downloadUrl, token);
        } else if (type === 'dir') {
            return this.retrieveFromGithubRecursive(srcDir, url, token);
        }
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
