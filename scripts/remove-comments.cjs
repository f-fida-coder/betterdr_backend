const fs = require('fs');
const path = require('path');

function isTextFile(file) {
  return /\.(js|jsx|css|html)$/.test(file);
}

function stripComments(code) {
  let out = '';
  let i = 0;
  const len = code.length;
  let inSingle = false, inDouble = false, inTemplate = false;
  let prev = '';

  while (i < len) {
    const ch = code[i];
    const next = code[i+1];

    if (!inTemplate && ch === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
      out += ch; i++; prev = ch; continue;
    }
    if (!inTemplate && ch === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
      out += ch; i++; prev = ch; continue;
    }
    if (!inSingle && !inDouble && ch === '`' && prev !== '\\') {
      inTemplate = !inTemplate;
      out += ch; i++; prev = ch; continue;
    }

    if (inSingle || inDouble || inTemplate) {
      out += ch; i++; prev = ch; continue;
    }

    if (ch === '<' && code.substr(i,4) === '<!--') {
      const end = code.indexOf('-->', i+4);
      if (end === -1) break; else { i = end+3; prev = ''; continue; }
    }

    if (ch === '/' && next === '/') {
      const nl = code.indexOf('\n', i+2);
      if (nl === -1) break; else { i = nl+1; prev = '\n'; continue; }
    }

    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i+2);
      if (end === -1) break; else { i = end+2; prev = ''; continue; }
    }

    out += ch;
    prev = ch;
    i++;
  }

  return out;
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!isTextFile(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');
  const stripped = stripComments(code);
  if (stripped !== code) {
    fs.writeFileSync(filePath, stripped, 'utf8');
    console.log('Stripped comments:', filePath);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(full);
    } else {
      if (isTextFile(full)) processFile(full);
    }
  }
}

const target = path.join(__dirname, '..');
process.chdir(target);
walk(path.join(target, 'src'));
if (fs.existsSync(path.join(target, 'index.html'))) processFile(path.join(target, 'index.html'));
console.log('Done.');
