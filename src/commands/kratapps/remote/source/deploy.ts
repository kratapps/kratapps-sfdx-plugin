import { SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('kratapps-sfdx-plugin', 'remoteSourceDeploy');

export default class Org extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx kratapps:source:deploy --targetusername myOrg@example.com
  `
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {};

  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    this.ux.log('todo');
    return { todo: 'lol' };
  }
}
