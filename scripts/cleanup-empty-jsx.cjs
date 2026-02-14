const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(full);
    } else {
      if (/\.(js|jsx)$/.test(full)) processFile(full);
    }
  }
}

function processFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const newCode = code.replace(/\n[ \t]*\{\}[ \t]*\n/g, '\n');
  if (newCode !== code) {
    fs.writeFileSync(filePath, newCode, 'utf8');
    console.log('Cleaned empty JSX braces:', filePath);
  }
}

const target = path.join(__dirname, '..');
walk(path.join(target, 'src'));
console.log('Done cleanup.');
