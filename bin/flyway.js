#!/usr/bin/env node

'use strict';

const program = require('commander');
const pkg = require('../package.json');
const path = require('path');
const spawn = require('child_process').spawn;
const download = require('../lib/download');

process.title = 'flyway';
program
    .version(pkg.version)
    .option('-c, --configfile <file>', 'A javascript or json file containing configuration.')
    .on('--help', function() {
        console.log('  See Flyway\'s configuration options at https://flywaydb.org/documentation/commandline/');
    });

makeCommand('migrate', 'Migrates the schema to the latest version. Flyway will create the metadata table automatically if it doesn\'t exist.');
makeCommand('clean', 'Drops all objects (tables, views, procedures, triggers, ...) in the configured schemas. The schemas are cleaned in the order specified by the schemas property.');
makeCommand('info', 'Prints the details and status information about all the migrations.');
makeCommand('validate', `Validate applied migrations against resolved ones (on the filesystem or classpath) to detect accidental changes that may prevent the schema(s) from being recreated exactly.

           Validation fails if
             - differences in migration names, types or checksums are found
             - versions have been applied that aren't resolved locally anymore
             - versions have been resolved that haven't been applied yet`);
makeCommand('baseline', 'Baselines an existing database, excluding all migrations up to and including baselineVersion.');
makeCommand('repair', `Repairs the Flyway metadata table. This will perform the following actions:

             - Remove any failed migrations on databases without DDL transactions
               (User objects left behind must still be cleaned up manually)
             - Correct wrong checksums`);

program.parse(process.argv);

function makeCommand(name, desc) {
    program
        .command(name)
        .description(desc)
        .action(exeCommand);
}

function configFlywayArgs(config) {
    const flywayArgs = config.flywayArgs || {};
    const flywayArgsKeys = Object.keys(flywayArgs);

    return flywayArgsKeys.map(function(key) {
        return `-${key}=${flywayArgs[key]}`;
    });
}

function exeCommand(cmd) {
    if(!program.configfile) {
        throw new Error('Config file option is required');
    }

    var config = require(path.resolve(program.configfile));

    if (typeof config === 'function') {
        config = config();
    }

    download.ensureArtifacts(config, function(err, flywayBin) {
        const workingDir = process.cwd();

        if(err) {
            throw new Error(err);
        }

        const args = configFlywayArgs(config)
            .concat([cmd._name]);

        const child = spawn(flywayBin, args, {
            env: Object.assign({}, process.env, config.env),
            cwd: workingDir,
            stdio: 'inherit',
            windowsVerbatimArguments: true // Super Weird, https://github.com/nodejs/node/issues/5060
        });

        child.on('close', code => {
            process.exit(code);
        });
    });
}
