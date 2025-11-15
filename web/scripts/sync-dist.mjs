import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = resolve(__dirname, '..', 'dist');
const targetDir = resolve(__dirname, '..', '..', 'data');

if (!existsSync(distDir)) {
  console.error('dist folder not found. Run "npm run build" first.');
  process.exit(1);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

console.log(`Synced ${distDir} -> ${targetDir}`);
