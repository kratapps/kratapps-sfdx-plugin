# Kratapps SFDX plugin

<!-- toc -->
* [Kratapps SFDX plugin](#kratapps-sfdx-plugin)
<!-- tocstop -->

<!-- install -->

```shell
sfdx plugins:install @kratapps/sfdx-plugin
```

<!-- commands -->
* [`sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [--ref <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kratappsremotesourcedeploy--p-string--s-string--t-string---ref-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [--ref <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy source to an org from GitHub

```
deploy source to an org from GitHub

USAGE
  $ sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [--ref <string>] [-u <string>] 
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --sourcepath=sourcepath                                                       (required) comma-separated list of
                                                                                    paths to the github source files to
                                                                                    deploy

  -s, --source=source                                                               (required) remote source, e.g.
                                                                                    https://github.com/kratapps/lwc-libr
                                                                                    ary

  -t, --token=token                                                                 external service access token

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --ref=ref                                                                         reference, e.g. main

EXAMPLE
  $ sfdx kratapps:remote:source:deploy --targetusername myOrg --source https://github.com/kratapps/lwc-library 
  --sourcepath src/main/default/lwc/spinner
```
<!-- commandsstop -->
