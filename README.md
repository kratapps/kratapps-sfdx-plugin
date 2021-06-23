# Kratapps SFDX plugin

<!-- toc -->
* [Kratapps SFDX plugin](#kratapps-sfdx-plugin)
<!-- tocstop -->

<!-- install -->

<!-- usage -->
```sh-session
$ npm install -g @kratapps/sfdx-plugin
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
@kratapps/sfdx-plugin/0.0.0 darwin-x64 node-v14.15.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->

<!-- commands -->
* [`sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-kratappsremotesourcedeploy--p-string--s-string--t-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy source to an org from GitHub

```
deploy source to an org from GitHub

USAGE
  $ sfdx kratapps:remote:source:deploy -p <string> -s <string> [-t <string>] [-u <string>] [--apiversion <string>] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

EXAMPLE
  $ sfdx kratapps:remote:source:deploy --targetusername myOrg@example.com --source 
  https://github.com/kratapps/lwc-library --sourcepath src/main/default/lwc
```
<!-- commandsstop -->
