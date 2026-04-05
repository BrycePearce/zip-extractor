import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { clearLine, cursorTo } from 'node:readline';
import { spawn } from 'node:child_process';
import path from 'node:path';
import pLimit from 'p-limit';
import { getArchiveFilepaths, prompt, requiresPassword } from './helper.js';

// ── Theme ────────────────────────────────────────────────────────────────────
const c = {
    banner:   chalk.bold.cyanBright,
    prompt:   chalk.cyan,
    info:     chalk.white,
    dim:      chalk.dim,
    success:  chalk.bold.greenBright,
    warn:     chalk.yellow,
    error:    chalk.bold.red,
    progress: (s: string) => chalk.bgCyanBright.black(s),
};

const banner = () => {
    console.log(c.banner('  ╔══════════════════════════╗'));
    console.log(c.banner('  ║  RAR + 7Z  Extractor     ║'));
    console.log(c.banner('  ╚══════════════════════════╝'));
    console.log();
};

// ── Archive helpers ───────────────────────────────────────────────────────────
const extractArchive = (archivePath: string, outputPath: string, password?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const args = ['x', archivePath, `-o${outputPath}`, '-y'];
        if (password) args.push(`-p${password}`);

        const proc = spawn('7z', args);
        let stderr = '';
        proc.stdout.on('data', () => {}); // consume to prevent buffer blocking
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
        proc.on('error', reject);
        proc.on('close', (code: number | null) => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `7z exited with code ${code}`));
        });
    });
};

const printProgress = (completed: number, total: number) => {
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    process.stdout.write(c.progress(` ${completed} / ${total} `));
};

// ── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
    banner();

    // Accept paths as optional CLI args, fall back to interactive prompts
    const [,, argInput, argOutput] = process.argv;
    const inputPath  = (argInput  ?? (await prompt(c.prompt('Source directory:\n')      + ' > '))).trim();
    const outputPath = (argOutput ?? (await prompt(c.prompt('Destination directory:\n') + ' > '))).trim();

    if (!existsSync(inputPath)) {
        console.log(c.error('\n✖  Invalid source path'));
        process.exit(1);
    }

    if (!existsSync(outputPath)) {
        await mkdir(outputPath, { recursive: true });
        console.log(c.dim(`Created ${outputPath}\n`));
    }

    const { filePaths, skippedDirs } = await getArchiveFilepaths(inputPath);

    if (skippedDirs.length > 0) {
        console.log(c.warn(`⚠  ${skippedDirs.length} director${skippedDirs.length === 1 ? 'y' : 'ies'} skipped (permission denied):`));
        skippedDirs.forEach(d => console.log(c.dim(`   ${d}`)));
        console.log();
    }

    if (filePaths.length === 0) {
        console.log(c.warn('⚠  No .rar, .7z, or .zip files found'));
        process.exit(0);
    }
    console.log(c.info(`Found ${chalk.bold(filePaths.length)} archive(s)\n`));

    // Scan for password-protected archives
    let scanned = 0;
    process.stdout.write(c.dim(`Scanning 0 / ${filePaths.length} archives...`));
    const scanLimit = pLimit(10);
    const passwordFlags = await Promise.all(
        filePaths.map(fp => scanLimit(async () => {
            const locked = await requiresPassword(fp);
            scanned++;
            clearLine(process.stdout, 0);
            cursorTo(process.stdout, 0);
            process.stdout.write(c.dim(`Scanning ${scanned} / ${filePaths.length} archives...`));
            return locked;
        }))
    );
    console.log();

    const lockedPaths = filePaths.filter((_, i) => passwordFlags[i]);
    const passwords = new Map<string, string>();

    if (lockedPaths.length > 0) {
        console.log(c.warn(`\n🔒 ${lockedPaths.length} archive(s) require a password:`));
        lockedPaths.forEach(p => console.log(c.warn(`   ${path.basename(p)}`)));

        const shared = (await prompt(c.prompt('\nPassword for all') + c.dim(' (enter to specify per archive)') + c.prompt(':\n') + ' > ')).trim();
        if (shared) {
            lockedPaths.forEach(p => passwords.set(p, shared));
        } else {
            for (const lp of lockedPaths) {
                const pw = (await prompt(c.prompt(`Password for ${chalk.bold(path.basename(lp))}`) + c.dim(' (enter to skip)') + c.prompt(':\n') + ' > ')).trim();
                if (pw) passwords.set(lp, pw);
            }
        }
        console.log();
    }

    // Extract
    let succeeded = 0;
    let failed = 0;
    const extractLimit = pLimit(5);
    await Promise.all(
        filePaths.map(filePath => extractLimit(async () => {
            try {
                await extractArchive(filePath, outputPath, passwords.get(filePath));
                succeeded++;
                printProgress(succeeded + failed, filePaths.length);
            } catch (err) {
                failed++;
                printProgress(succeeded + failed, filePaths.length);
                console.error(c.error(`\n✖  ${path.basename(filePath)}: ${(err as Error).message}`));
            }
        }))
    );

    // Summary
    console.log('\n');
    if (failed === 0) {
        console.log(c.success(`✔  All ${succeeded} archive(s) extracted successfully`));
    } else {
        console.log(c.success(`✔  ${succeeded} extracted`) + '  ' + c.error(`✖  ${failed} failed`));
    }
};

main();
