import { Messages, Org, SfError } from '@salesforce/core';
import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import {
    acceptHeader,
    getRepositoryContent,
    GithubContent,
    isGithubContent,
    StructuredFileLocation
} from "../../../../lib/github";
import { ensureString, isArray } from "@salesforce/ts-types";
import { join } from "path";
import { outputFileSync } from "fs-extra";
import { executeDeploy, resolveApi } from "@salesforce/plugin-deploy-retrieve/lib/utils/deploy";
import { getVersionMessage } from "@salesforce/plugin-deploy-retrieve/lib/utils/output";
import { DeployProgress } from "@salesforce/plugin-deploy-retrieve/lib/utils/progressBar";
import { SfProject } from "@salesforce/core/lib/sfProject";
import { dirSync } from "tmp";
import rimraf = require("rimraf");

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@kratapps/sfdx-plugin', 'remoteDeployStart');

type DeployResultJson = {}

export default class RemoteDeployStart extends SfCommand<DeployResultJson> {
    public static readonly description = messages.getMessage('description');
    public static readonly summary = messages.getMessage('summary');
    public static readonly examples = messages.getMessages('examples');
    public static readonly requiresProject = false;

    public static readonly flags: any = {
        'target-org': Flags.requiredOrg({
            char: 'o',
            description: messages.getMessage('targetOrgFlagDescription'),
            summary: messages.getMessage('targetOrgFlagDescription'),
            required: true,
        }),
        "repo-owner": Flags.string({
            description: messages.getMessage('sourceUrlFlagDescription'),
            summary: messages.getMessage('sourceUrlFlagDescription'),
            required: true
        }),
        "repo-name": Flags.string({
            description: messages.getMessage('sourceUrlFlagDescription'),
            summary: messages.getMessage('sourceUrlFlagDescription'),
            required: true
        }),
        "repo-ref": Flags.string({
            description: messages.getMessage('sourceUrlFlagDescription'),
            summary: messages.getMessage('sourceUrlFlagDescription'),
        }),
        "source-dir": Flags.string({
            char: 'd',
            description: messages.getMessage('sourceDirFlagDescription'),
            summary: messages.getMessage('sourceDirFlagDescription'),
            required: true
        }),
        token: Flags.string({
            description: messages.getMessage('tokenFlagDescription'),
            summary: messages.getMessage('tokenFlagDescription'),
        }),
        // ref: flags.string({
        //   description: messages.getMessage('refFlagDescription'),
        // })
    };

    public async run(): Promise<DeployResultJson> {
        const { flags } = await this.parse(RemoteDeployStart);
        const targetOrg = flags['target-org'];
        const repoOwner = ensureString(flags["repo-owner"], 'repo-owner must be a string');
        const repoName = ensureString(flags["repo-name"], 'repo-name must be a string');
        const repoRef = flags["repo-ref"];
        let sourceDir = flags["source-dir"];
        const token = flags.token;
        const { name: projectDir } = dirSync();
        process.chdir(projectDir);
        outputFileSync(`${projectDir}/sfdx-project.json`, JSON.stringify(this.createSfdxProjectJsonData()));
        const sfProject = await SfProject.resolve(projectDir);
        this.spinner.start(`Downloading source from GitHub repo ${repoOwner}/${repoName}${repoRef ? `:${repoRef}` : ''}`);
        await this.retrieveFromGithubRecursive(projectDir, {
            owner: repoOwner,
            repo: repoName,
            path: sourceDir,
            ref: repoRef
        }, token);
        this.spinner.stop();
        await this.deploy({
            sfProject,
            targetOrg
        });
        this.spinner.start('Cleanup');
        rimraf.sync(projectDir);
        this.spinner.stop();
        return {};
    }

    private async deploy({ sfProject, targetOrg }: { sfProject: SfProject, targetOrg: Org }) {
        const { flags } = await this.parse(RemoteDeployStart);
        const api = await resolveApi(this.configAggregator);
        const { deploy, componentSet } = await executeDeploy({
                "source-dir": [`src/${flags['source-dir']}`],
                "target-org": targetOrg.getUsername(),
                "ignore-conflicts": true,
                api,
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
            const result = await deploy.pollStatus({ timeout: flags.wait });
        } catch (e: any) {
            if (!e?.stack?.includes('SourceTracking.updateLocalTracking')) {
                throw e;
            }
        }
    }

    private async retrieveFromGithubRecursive(srcDir: string, target: StructuredFileLocation | string, token: string): Promise<void> {
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

    private async processItem(srcDir: string, content: GithubContent, token: string) {
        const { type, path, name, url, download_url: downloadUrl } = content;
        if (type === 'file' && downloadUrl) {
            this.info(name);
            return this.saveFileFromGithub(join(srcDir, 'src', path), downloadUrl, token);
        } else if (type === 'dir') {
            return this.retrieveFromGithubRecursive(srcDir, url, token);
        }
    }

    private async saveFileFromGithub(path: string, target: string, token: string) {
        const data = await getRepositoryContent({
            target,
            accept: acceptHeader.raw,
            token
        });
        return outputFileSync(path, data);
    }

    private createSfdxProjectJsonData() {
        return {
            "packageDirectories": [
                {
                    "path": "src/",
                    "default": true
                }
            ],
            "namespace": "",
            "sfdcLoginUrl": "https://login.salesforce.com",
            "sourceApiVersion": "57.0"
        }
    }
}
