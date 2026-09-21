const Fs = require('node:fs');
const Path = require('node:path');
const Process = require('node:process');
const { spawnSync: Spawn } = require('node:child_process');
const Files = Fs.readdirSync(__dirname).filter(Name => Name.endsWith('.test.cjs')).sort().map(Name => Path.join(__dirname, Name));
Process.exitCode = Spawn(Process.execPath, ['--test', '--test-concurrency=1', ...Files], { stdio: 'inherit', windowsHide: true }).status ?? 1;
