import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'fs';

const OUT_DIR = 'output';
const BUNDLE = `${OUT_DIR}/bundle.js`;
const BLOB = `${OUT_DIR}/sea.blob`;
const EXE = `${OUT_DIR}/extract.exe`;
const SEA_CONFIG = 'sea-config.json';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);

// 1. Bundle TS → single CJS file (SEA requires CJS)
console.log('Bundling...');
execSync(
    `npx esbuild extract.ts --bundle --platform=node --format=cjs --outfile=${BUNDLE}`,
    { stdio: 'inherit' }
);

// 2. Write SEA config
writeFileSync(SEA_CONFIG, JSON.stringify({
    main: BUNDLE,
    output: BLOB,
    disableExperimentalSEAWarning: true
}, null, 2));

// 3. Generate blob
console.log('Generating SEA blob...');
execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });

// 4. Copy node binary
console.log('Copying node binary...');
copyFileSync(process.execPath, EXE);

// 5. Remove codesignature (required on Windows before postject can inject)
try {
    execSync(`signtool remove /s ${EXE}`, { stdio: 'pipe' });
} catch {
    // signtool not available or binary not signed — safe to continue
}

// 6. Inject blob
console.log('Injecting SEA blob...');
execSync(
    `node_modules/.bin/postject ${EXE} NODE_SEA_BLOB ${BLOB} --sentinel-fuse ${FUSE} --overwrite`,
    { stdio: 'inherit' }
);

// 7. Clean up temp files
rmSync(SEA_CONFIG, { force: true });
rmSync(BUNDLE, { force: true });
rmSync(BLOB, { force: true });

console.log(`\nDone — ${EXE}`);
