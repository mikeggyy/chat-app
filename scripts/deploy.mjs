import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const FRONTEND_DIR = join(ROOT, 'frontend');

const args = process.argv.slice(2);
const skipInstall = args.includes('--skip-install');
const deployAll = args.includes('--all');
const onlyFunctions = args.includes('--functions');
const firebaseArgs = ['deploy'];

if (onlyFunctions && deployAll) {
  console.warn('Ignoring --functions because --all was provided.');
}

if (deployAll) {
  // no extra args, deploy everything
} else if (onlyFunctions) {
  firebaseArgs.push('--only', 'functions');
} else {
  firebaseArgs.push('--only', 'hosting');
}

async function run(command, commandArgs, options = {}) {
  const isWin = process.platform === 'win32';
  const spawnOptions = {
    stdio: 'inherit',
    shell: isWin,
    ...options,
  };

  return new Promise((resolvePromise, rejectPromise) => {
    const subprocess = spawn(command, commandArgs, spawnOptions);

    subprocess.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(
          new Error(`${command} ${commandArgs.join(' ')} exited with code ${code}`)
        );
      }
    });
  });
}

async function main() {
  console.log('== Frontend build ==');
  if (!skipInstall) {
    console.log('Installing frontend dependencies...');
    await run('npm', ['install'], { cwd: FRONTEND_DIR });
  } else if (!existsSync(join(FRONTEND_DIR, 'node_modules'))) {
    console.log('node_modules missing, performing install despite --skip-install');
    await run('npm', ['install'], { cwd: FRONTEND_DIR });
  }

  console.log('Building frontend...');
  await run('npm', ['run', 'build'], { cwd: FRONTEND_DIR });

  console.log('== Firebase deploy ==');
  await run('firebase', firebaseArgs, { cwd: ROOT });

  console.log('Deployment complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
