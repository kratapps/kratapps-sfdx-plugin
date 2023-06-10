import { outputFileSync } from 'fs-extra';
import { join } from 'path';
import { dirSync } from 'tmp';

import { Messages, Org, SfError } from '@salesforce/core';
import { ProjectJson, SfProject } from '@salesforce/core/lib/sfProject';
import { executeDeploy, resolveApi } from '@salesforce/plugin-deploy-retrieve/lib/utils/deploy';
import { getVersionMessage } from '@salesforce/plugin-deploy-retrieve/lib/utils/output';
import { DeployProgress } from '@salesforce/plugin-deploy-retrieve/lib/utils/progressBar';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Optional, hasString, isArray } from '@salesforce/ts-types';

import { FlagInput, FlagOutput } from '@oclif/core/lib/interfaces/parser';

import {
    RepositoryContent,
    StructuredFileLocation,
    acceptHeader,
    getRepositoryContent,
    isRepositoryContent
} from '../../../../utils/github';
import { MetadataTypeInfo, getTypeInfo } from '../../../../utils/metadataTypeInfos';

import rimraf = require('rimraf');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@kratapps/sfdx-plugin', 'remoteDeployStart');

type DeployResultJson = object;

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
    if (!info?.metadataName) {
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

    public static readonly flags: FlagInput = {
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
        const { flags }: { flags: FlagOutput } = await this.parse(RemoteDeployStart);
        const targetOrg = flags['target-org'] as Org;
        const repoOwner = flags['repo-owner'] as string;
        const repoName = flags['repo-name'] as string;
        const repoRef = flags['repo-ref'] as Optional<string>;
        const sourceDirs = flags['source-dir'] as string[];
        const metadata = flags['metadata'] as string[];
        const token = flags.token as Optional<string>;
        const { name: projectDir } = dirSync();
        process.chdir(projectDir);
        outputFileSync(`${projectDir}/sfdx-project.json`, JSON.stringify(createSfdxProjectJsonData()));
        const sfProject = await SfProject.resolve(projectDir);
        this.log(`Downloading source from GitHub repo ${repoOwner}/${repoName}${repoRef ? `:${repoRef}` : ''}`);
        if (sourceDirs?.length) {
            await Promise.all(
                sourceDirs.map((sourceDir) =>
                    this.saveFileFromGithubRecursive(
                        projectDir,
                        {
                            owner: repoOwner,
                            repo: repoName,
                            path: sourceDir,
                            ref: repoRef
                        },
                        token
                    )
                )
            );
        } else if (metadata?.length) {
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
        await this.deploy({
            sfProject,
            targetOrg,
            sourceDirs,
            metadata
        });
        this.log('Cleanup');
        rimraf.sync(projectDir);
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
    }): Promise<void> {
        const api = await resolveApi(this.configAggregator);
        const { deploy, componentSet } = await executeDeploy(
            {
                'source-dir': sourceDirs ? sourceDirs.map((it) => `src/${it}`) : undefined,
                metadata,
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
            await deploy.pollStatus();
        } catch (e: unknown) {
            if (!hasString(e, 'stack') || !e.stack.includes('SourceTracking.updateLocalTracking')) {
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
        if (isRepositoryContent(content)) {
            promises.push(this.visitMetadataFromGithubToSave(srcDir, metadata, content, token));
        } else if (isArray<RepositoryContent>(content)) {
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
        if (isRepositoryContent(content)) {
            promises.push(this.visitFileFromGithubToSave(projectDir, content, token));
        } else if (isArray<RepositoryContent>(content)) {
            for (const item of content) {
                promises.push(this.visitFileFromGithubToSave(projectDir, item, token));
            }
        }
        await Promise.all(promises);
    }

    private async visitMetadataFromGithubToSave(
        projectDir: string,
        metadata: RequestedMetadata[],
        content: RepositoryContent,
        token: Optional<string>
    ): Promise<void> {
        const { type, path, name, url, download_url: downloadUrl } = content;
        if (type === 'file' && downloadUrl) {
            if (name.includes('.')) {
                const fileNameWithoutExt = name.split('.')[0];
                if (fileNameWithoutExt?.length) {
                    const pathParts = path.split('/');
                    const mdt = metadata.find(
                        (it) =>
                            (it.name === fileNameWithoutExt || pathParts.includes(it.name)) &&
                            pathParts.includes(it.info.directoryName) &&
                            (!it.info.parent || pathParts.includes(it.info.parent.directoryName))
                    );
                    if (mdt) {
                        this.info(name);
                        return saveFileFromGithub(join(projectDir, 'src', path), downloadUrl, token);
                    }
                }
            }
            return Promise.resolve();
        } else if (type === 'dir' && name !== 'node_modules') {
            return this.saveMetadataFromGithubRecursive(projectDir, metadata, url, token);
        }
    }

    private async visitFileFromGithubToSave(projectDir: string, content: RepositoryContent, token: Optional<string>): Promise<void> {
        const { type, path, name, url, download_url: downloadUrl } = content;
        if (type === 'file' && downloadUrl) {
            this.info(name);
            return saveFileFromGithub(join(projectDir, 'src', path), downloadUrl, token);
        } else if (type === 'dir') {
            return this.saveFileFromGithubRecursive(projectDir, url, token);
        }
    }
}

async function saveFileFromGithub(path: string, target: string, token: Optional<string>): Promise<void> {
    const data = await getRepositoryContent({
        target,
        accept: acceptHeader.raw,
        token
    });
    outputFileSync(path, data);
}

function createSfdxProjectJsonData(): ProjectJson {
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
