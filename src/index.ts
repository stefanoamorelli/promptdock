#!/usr/bin/env node
import { Command } from 'commander';
import init from './commands/init.js';
import sync from './commands/sync.js';
import newCmd from './commands/new.js';
import list from './commands/list.js';
import status from './commands/status.js';
import edit from './commands/edit.js';
import deleteCmd from './commands/delete.js';
import pullCmd from './commands/pull.js';
import push from './commands/push.js';

const program = new Command();
program.name('prompt').description('Prompt management CLI');

program.addCommand(init);
program.addCommand(sync);
program.addCommand(newCmd);
program.addCommand(list);
program.addCommand(status);
program.addCommand(edit);
program.addCommand(deleteCmd);
program.addCommand(pullCmd);
program.addCommand(push);
program.parseAsync();
