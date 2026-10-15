const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'testStateHints.mjs');
const child = spawn('node', ['--experimental-network-imports', scriptPath], { stdio: 'inherit' });

child.on('close', code => process.exit(code));
