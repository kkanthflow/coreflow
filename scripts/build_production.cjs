const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('1. Building web frontend (Vite)...');
execSync('npm --prefix web run build', { stdio: 'inherit' });

console.log('2. Syncing web/dist into root dist folder...');
const webDist = path.join(__dirname, '..', 'web', 'dist');
const rootDist = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(rootDist)) {
  fs.mkdirSync(rootDist, { recursive: true });
}

// Copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(webDist, rootDist);
console.log('Frontend synced to dist/ successfully.');

console.log('3. Bundling server with esbuild...');
execSync('npx esbuild server/_core/index.ts --platform=node --bundle --format=cjs --outfile=dist-server/index.js', { stdio: 'inherit' });

console.log('4. Updating api/index.js for Vercel Serverless...');
fs.copyFileSync(
  path.join(__dirname, '..', 'dist-server', 'index.js'),
  path.join(__dirname, '..', 'api', 'index.js')
);

console.log('Production build completed successfully!');
