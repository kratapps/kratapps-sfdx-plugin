import { Messages, Org, SfError } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { acceptHeader, getRepositoryContent, GithubContent, isGithubContent, StructuredFileLocation } from '../../../../lib/github';
import { ensureString, isArray, Optional } from '@salesforce/ts-types';
import { join } from 'path';
import { outputFileSync } from 'fs-extra';
import { executeDeploy, resolveApi } from '@salesforce/plugin-deploy-retrieve/lib/utils/deploy';
import { getVersionMessage } from '@salesforce/plugin-deploy-retrieve/lib/utils/output';
import { DeployProgress } from '@salesforce/plugin-deploy-retrieve/lib/utils/progressBar';
import { SfProject } from '@salesforce/core/lib/sfProject';
import { dirSync } from 'tmp';
import rimraf = require('rimraf');
import { getTypeInfo, MetadataTypeInfo } from '../../../../lib/metadataTypeInfos';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@kratapps/sfdx-plugin', 'remoteDeployStart');

type DeployResultJson = {};

const exclusiveFlags = ['source-dir', 'metadata'];

type RequestedMetadata = {
    info: MetadataTypeInfo;
    name: string;
};

function describeRequestedMetadata(metadataArg: string): RequestedMetadata {
    if (!metadataArg.includes(':')) {
        throw new SfError(`Invalid metadata: ${metadataArg}`);
    }
    const [metadataName, componentName] = metadataArg.split(':');
    const info = getTypeInfo(metadataName);
    if (!info || !info.metadataName) {
        throw new SfError(`Invalid metadata: ${metadataArg}`);
    } else if (!componentName.length) {
        throw new SfError(`Invalid metadata: ${metadataArg}`);
    }
    return {
        info,
        name: componentName
    };
}

export default class RemoteDeployStart extends SfCommand<DeployResultJson> {
    public static readonly description = messages.getMessage('description');
    public static readonly summary = messages.getMessage('summary');
    public static readonly examples = messages.getMessages('examples');
    public static readonly requiresProject = false;

    public static readonly flags: any = {
        'target-org': Flags.requiredOrg({
            char: 'o',
            summary: messages.getMessage('targetOrgFlagSummary'),
            description: messages.getMessage('targetOrgFlagSummary'),
            default: undefined,
            required: true
        }),
        'repo-owner': Flags.string({
            summary: messages.getMessage('repoOwnerFlagSummary'),
            description: messages.getMessage('repoOwnerFlagSummary'),
            required: true
        }),
        'repo-name': Flags.string({
            summary: messages.getMessage('repoNameFlagSummary'),
            description: messages.getMessage('repoNameFlagSummary'),
            required: true
        }),
        'repo-ref': Flags.string({
            summary: messages.getMessage('repoRefFlagSummary'),
            description: messages.getMessage('repoRefFlagSummary')
        }),
        'source-dir': Flags.string({
            char: 'd',
            summary: messages.getMessage('sourceDirFlagSummary'),
            description: messages.getMessage('sourceDirFlagSummary'),
            multiple: true,
            exclusive: exclusiveFlags.filter((f) => f !== 'source-dir')
        }),
        metadata: Flags.string({
            char: 'm',
            summary: messages.getMessage('metadataFlagSummary'),
            description: messages.getMessage('metadataFlagSummary'),
            multiple: true,
            exclusive: exclusiveFlags.filter((f) => f !== 'metadata')
        }),
        token: Flags.string({
            summary: messages.getMessage('tokenFlagSummary'),
            description: messages.getMessage('tokenFlagSummary')
        })
    };

    public async run(): Promise<DeployResultJson> {
        const { flags } = await this.parse(RemoteDeployStart);
        const targetOrg = flags['target-org'];
        const repoOwner = ensureString(flags['repo-owner']);
        const repoName = ensureString(flags['repo-name']);
        const repoRef = flags['repo-ref'];
        const sourceDirs: string[] = flags['source-dir'];
        const metadata: string[] = flags['metadata'];
        const token: Optional<string> = flags.token;
        const { name: projectDir } = dirSync();
        process.chdir(projectDir);
        outputFileSync(`${projectDir}/sfdx-project.json`, JSON.stringify(this.createSfdxProjectJsonData()));
        const sfProject = await SfProject.resolve(projectDir);
        this.spinner.start(`Downloading source from GitHub repo ${repoOwner}/${repoName}${repoRef ? `:${repoRef}` : ''}`);
        if (sourceDirs && sourceDirs.length) {
            for (let sourceDir of sourceDirs) {
                await this.saveFileFromGithubRecursive(
                    projectDir,
                    {
                        owner: repoOwner,
                        repo: repoName,
                        path: sourceDir,
                        ref: repoRef
                    },
                    token
                );
            }
        } else if (metadata && metadata.length) {
            const requestedMetadata: RequestedMetadata[] = metadata.map(describeRequestedMetadata);
            await this.saveMetadataFromGithubRecursive(
                projectDir,
                requestedMetadata,
                {
                    owner: repoOwner,
                    repo: repoName,
                    path: '/',
                    ref: repoRef
                },
                token
            );
        } else {
            throw new SfError('Nothing specified to deploy.');
        }
        this.spinner.stop();
        await this.deploy({
            sfProject,
            targetOrg,
            sourceDirs,
            metadata
        });
        this.spinner.start('Cleanup');
        rimraf.sync(projectDir);
        this.spinner.stop();
        return {};
    }

    private async deploy({
        sfProject,
        targetOrg,
        sourceDirs,
        metadata
    }: {
        sfProject: SfProject;
        targetOrg: Org;
        sourceDirs: string[];
        metadata: string[];
    }) {
        const { flags } = await this.parse(RemoteDeployStart);
        const api = await resolveApi(this.configAggregator);
        const { deploy, componentSet } = await executeDeploy(
            {
                'source-dir': sourceDirs ? sourceDirs.map((it) => `src/${it}`) : undefined,
                metadata: metadata,
                'target-org': targetOrg.getUsername(),
                'ignore-conflicts': true,
                api
            },
            this.config.bin,
            sfProject
        );
        this.log(getVersionMessage('Deploying', componentSet, api));
        if (!deploy.id) {
            throw new SfError('The deploy id is not available.');
        }
        this.log(`Deploy ID: ${deploy.id}`);
        new DeployProgress(deploy, this.jsonEnabled()).start();
        try {
            await deploy.pollStatus({ timeout: flags.wait });
        } catch (e: any) {
            if (!e?.stack?.includes('SourceTracking.updateLocalTracking')) {
                throw e;
            }
        }
    }

    private async saveMetadataFromGithubRecursive(
        srcDir: string,
        metadata: RequestedMetadata[],
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
            promises.push(this.visitMetadataFromGithubToSave(srcDir, metadata, content, token));
        } else if (isArray<GithubContent>(content)) {
            for (const item of content) {
                promises.push(this.visitMetadataFromGithubToSave(srcDir, metadata, item, token));
            }
        }
        await Promise.all(promises);
    }

    private async saveFileFromGithubRecursive(
        projectDir: string,
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
            promises.push(this.visitFileFromGithubToSave(projectDir, content, token));
        } else if (isArray<GithubContent>(content)) {
            for (const item of content) {
                promises.push(this.visitFileFromGithubToSave(projectDir, item, token));
            }
        }
        await Promise.all(promises);
    }

    private async visitMetadataFromGithubToSave(
        projectDir: string,
        metadata: RequestedMetadata[],
        content: GithubContent,
        token: Optional<string>
    ) {
        const { type, path, name, url, download_url: downloadUrl } = content;
        if (type === 'file' && downloadUrl) {
            if (name.includes('.')) {
                const fileNameWithoutExt = name.split('.')[0];
                if (fileNameWithoutExt && fileNameWithoutExt.length) {
                    const pathParts = path.split('/');
                    const mdt = metadata.find(
                        (it) =>
                            (it.name === fileNameWithoutExt || pathParts.includes(it.name)) &&
                            pathParts.includes(it.info.directoryName) &&
                            (!it.info.parent || pathParts.includes(it.info.parent.directoryName))
                    );
                    if (mdt) {
                        this.info(name);
                        return this.saveFileFromGithub(join(projectDir, 'src', path), downloadUrl, token);
                    }
                }
            }
            return Promise.resolve();
        } else if (type === 'dir' && name !== 'node_modules') {
            return this.saveMetadataFromGithubRecursive(projectDir, metadata, url, token);
        }
    }

    private async visitFileFromGithubToSave(projectDir: string, content: GithubContent, token: Optional<string>) {
        const { type, path, name, url, download_url: downloadUrl } = content;
        if (type === 'file' && downloadUrl) {
            this.info(name);
            return this.saveFileFromGithub(join(projectDir, 'src', path), downloadUrl, token);
        } else if (type === 'dir') {
            return this.saveFileFromGithubRecursive(projectDir, url, token);
        }
    }

    private async saveFileFromGithub(path: string, target: string, token: Optional<string>) {
        const data = await getRepositoryContent({
            target,
            accept: acceptHeader.raw,
            token
        });
        return outputFileSync(path, data);
    }

    private createSfdxProjectJsonData() {
        return {
            packageDirectories: [
                {
                    path: 'src/',
                    default: true
                }
            ],
            namespace: '',
            sfdcLoginUrl: 'https://login.salesforce.com',
            sourceApiVersion: '57.0'
        };
    }
}
