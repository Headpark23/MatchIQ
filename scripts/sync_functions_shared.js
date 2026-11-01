// Copies the browser modules the server shares with the app into functions/shared, so both run
// the same settlement and period code. Runs before every functions deploy (see firebase.json).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'functions', 'shared'), { recursive: true });
for (const file of ['settlement.js', 'league_sync.js']) {
  fs.copyFileSync(path.join(root, file), path.join(root, 'functions', 'shared', file));
}
console.log('functions/shared updated');
