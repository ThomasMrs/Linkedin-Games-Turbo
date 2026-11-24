import { build } from 'esbuild';
import { promises } from 'fs';
import { join } from 'path';
import { watch } from 'chokidar';

let isWatchMode = process.argv.includes('--watch');
const isRelease = process.argv.includes('--release');
const isMinify = isRelease && process.argv.includes('--minify');
if (isRelease) {
  if (isWatchMode) {
    console.warn('Watcher disabled on --release');
    isWatchMode = false;
  }
}

const distDir = 'dist';
const chromeDist = 'chrome-dist';
const firefoxDist = 'firefox-dist';

const iconPngNames = ['16', '32', '48', '64', '96', '128']
    .map(s => 'icon-' + s + '.png');
const sharedOutputFiles = [
  ...iconPngNames,
  'icon.svg',
  'popup.html',
  'popup.css',
  'popup.js',
  'queens.js',
  'zip.js',
  'tango.js',
  'sudoku.js',
  'navigationListener.js',
];

const scriptsToBuild = [
  { entry: 'src/main/js/queens/queens.js', out: `${distDir}/queens.js` },
  { entry: 'src/main/js/zip/zip.js', out: `${distDir}/zip.js` },
  { entry: 'src/main/js/tango/tango.js', out: `${distDir}/tango.js` },
  { entry: 'src/main/js/sudoku/sudoku.js', out: `${distDir}/sudoku.js` },
  { entry: 'src/main/js/navigationListener.js', out: `${distDir}/navigationListener.js` },
  { entry: 'src/main/js/popup.js', out: `${distDir}/popup.js` },
];

async function runBuilds() {
  try {
    await promises.mkdir(distDir, { recursive: true });
    await promises.mkdir(chromeDist, { recursive: true });
    await promises.mkdir(firefoxDist, { recursive: true });

    await Promise.all(
      scriptsToBuild.map(({ entry, out }) =>
        build({
          entryPoints: [entry],
          bundle: true,
          minify: isMinify,
          format: 'iife',
          outfile: out,
        })
      )
    );
    await promises.copyFile('src/assets/html/popup.html', `${distDir}/popup.html`);
    await promises.copyFile('src/assets/css/popup.css', `${distDir}/popup.css`);
    const metaSrc = 'src/assets/meta';
    for (const iconPngName of iconPngNames) {
      await promises.copyFile(join(metaSrc, iconPngName), join(distDir, iconPngName));
    }
    await promises.copyFile(join(metaSrc, 'icon.svg'), `${distDir}/icon.svg`);

    await promises.copyFile(join(metaSrc, 'manifest-chrome.json'), join(chromeDist, 'manifest.json'));
    await promises.copyFile(join(metaSrc, 'manifest-firefox.json'), join(firefoxDist, 'manifest.json'));
    for (const file of sharedOutputFiles) {
      const srcPath = join(distDir, file);
      await promises.copyFile(srcPath, join(chromeDist, file));
      await promises.copyFile(srcPath, join(firefoxDist, file));
    }
    try {
      await promises.rm(distDir, { recursive: true });
    } catch (e) {
      console.warn('Failed to remove dist/; try to remove it manually', e);
    }
    console.log('Build complete. Outputs: chrome-dist/ and firefox-dist/');
  } catch (err) {
    console.error(err);
    if (!isWatchMode) {
      process.exit(1);
    }
  }
}

function watchAndRebuild() {
  const watcher = watch('src', {
    ignoreInitial: true,
    persistent: true,
  });
  watcher.on('all', (event, path) => {
    console.log(`[Watcher] ${event}: ${path}`);
    runBuilds();
  });
  console.log('[Watcher] Watching for changes in src/ ...');
}

runBuilds().then(() => {
  if (isWatchMode) {
    watchAndRebuild();
  }
});
