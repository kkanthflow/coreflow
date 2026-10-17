const fs = require('fs');
const path = require('path');

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir);
const allTables = new Set();

for (const file of files) {
  if (file.endsWith('.sql')) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const regex = /CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z0-9_."]+)/gi;
    let m;
    while ((m = regex.exec(content)) !== null) {
      allTables.add(m[1].replace(/["\s]/g, '').replace('public.', ''));
    }
  }
}

console.log(Array.from(allTables).sort());
