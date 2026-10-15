// copy-dice-assets.js
const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.join(__dirname, 'node_modules', '@3d-dice', 'dice-box', 'dist', 'assets');
const targetDir = path.join(__dirname, 'public', 'assets', 'dice-box');

// Ensure the target directory exists
fs.ensureDirSync(targetDir);

// Copy the assets
fs.copy(sourceDir, targetDir, err => {
  if (err) return console.error('Error copying dice assets:', err);
  console.log('Successfully copied dice assets to public directory!');
});
