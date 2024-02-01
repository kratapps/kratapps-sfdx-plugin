# Kratapps SFDX plugin

DEPRECATED.

Use [kratapps/sf-plugin](https://github.com/kratapps/sf-plugin/) instead.

<!-- toc -->

- [Kratapps SFDX plugin](#kratapps-sfdx-plugin)
<!-- tocstop -->

<!-- install -->

```shell
sfdx plugins:install @kratapps/sfdx-plugin
```

<!-- commands -->

- [`sfdx kratapps remote deploy start`](#sfdx-kratapps-remote-deploy-start)
- [`sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [--ref <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kratappsremotesourcedeploy--p-string--s-string--t-string---ref-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx kratapps remote deploy start`

Deploy remote code, for example from GitHub.

```
USAGE
  $ sfdx kratapps remote deploy start -o <value> --repo-owner <value> --repo-name <value> [--json] [--repo-ref <value>] [-d
    <value> | -m <value>] [--token <value>]

FLAGS
  -d, --source-dir=<value>...  Path to the remote source files to deploy.
  -m, --metadata=<value>...    Metadata component names to deploy.
  -o, --target-org=<value>     (required) Login username or alias for the target org.
  --repo-name=<value>          (required) Repository name.
  --repo-owner=<value>         (required) Repository owner.
  --repo-ref=<value>           Reference, could be a git branch name, rev, tag.
  --token=<value>              API token to the external service, e.g. GitHub API Token. Required for private
                               repositories and to increase GitHub API request limit.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Deploy remote code, for example from GitHub.

  Deploy remote code, for example from GitHub.

EXAMPLES
  $ sfdx kratapps remote deploy start --repo-owner kratapps --repo-name component-library --source-dir src/main/default/lwc/spinner/

  $ sfdx kratapps remote deploy start --repo-owner kratapps --repo-name component-library --metadata LightningComponentBundle:spinner

FLAG DESCRIPTIONS
  -d, --source-dir=<value>...  Path to the remote source files to deploy.

    Path to the remote source files to deploy.

  -m, --metadata=<value>...  Metadata component names to deploy.

    Metadata component names to deploy.

  -o, --target-org=<value>  Login username or alias for the target org.

    Login username or alias for the target org.

  --repo-name=<value>  Repository name.

    Repository name.

  --repo-owner=<value>  Repository owner.

    Repository owner.

  --repo-ref=<value>  Reference, could be a git branch name, rev, tag.

    Reference, could be a git branch name, rev, tag.

  --token=<value>

    API token to the external service, e.g. GitHub API Token. Required for private repositories and to increase GitHub
    API request limit.

    API token to the external service, e.g. GitHub API Token. Required for private repositories and to increase GitHub
    API request limit.
```

## `sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [--ref <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Deprecated. Use "kratapps remote deploy start" instead. Deploy source to an org from GitHub.

```
USAGE
  $ sfdx kratapps remote source deploy -p <string> -s <string> [-t <string>] [--ref <string>] [-u <string>] [--apiversion <string>]
    [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

FLAGS
  -p, --sourcepath=<value>                                                          (required) comma-separated list of
                                                                                    paths to the github source files to
                                                                                    deploy
  -s, --source=<value>                                                              (required) remote source, e.g. https
                                                                                    ://github.com/kratapps/lwc-library
  -t, --token=<value>                                                               external service access token
  -u, --targetusername=<value>                                                      username or alias for the target
                                                                                    org; overrides default target org
  --apiversion=<value>                                                              override the api version used for
                                                                                    api requests made by this command
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
  --ref=<value>                                                                     reference, e.g. main

DESCRIPTION
  Deprecated. Use "kratapps remote deploy start" instead. Deploy source to an org from GitHub.

EXAMPLES
  $ sfdx kratapps:remote:source:deploy --targetusername myOrg --source https://github.com/kratapps/component-library --sourcepath src/main/default/lwc/spinner
```

<!-- commandsstop -->
