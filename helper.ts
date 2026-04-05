import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

export const prompt = async (query: string): Promise<string> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const response = await rl.question(query);
    rl.close();
    return response;
};

export const requiresPassword = (archivePath: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const proc = spawn('7z', ['t', archivePath]);
        let output = '';
        proc.stdout.on('data', (data: Buffer) => { output += data.toString(); });
        proc.stderr.on('data', (data: Buffer) => { output += data.toString(); });
        proc.on('error', reject);
        proc.on('close', (code: number | null) => {
            if (code === 0) {
                resolve(false);
            } else {
                const lower = output.toLowerCase();
                resolve(lower.includes('password') || lower.includes('encrypted'));
            }
        });
    });
};

// Only keep .part1.rar (or unpatterned .rar) — skip secondary parts to avoid
// double-extracting multi-volume sets.
const isSecondaryPart = (filename: string): boolean => {
    const match = filename.match(/\.part(\d+)\.rar$/i);
    return match !== null && parseInt(match[1], 10) > 1;
};

export type ScanResult = { filePaths: string[]; skippedDirs: string[] };

export const getArchiveFilepaths = async (directoryPath: string): Promise<ScanResult> => {
    const filePaths: string[] = [];
    const skippedDirs: string[] = [];

    for await (const file of getFiles(directoryPath, skippedDirs)) {
        const ext = path.extname(file.name).toLowerCase();
        if (['.rar', '.7z', '.zip'].includes(ext) && !isSecondaryPart(file.name)) {
            filePaths.push(file.path);
        }
    }

    return { filePaths, skippedDirs };
};

type FileEntry = { name: string; path: string };

async function* getFiles(rootDirectory: string, skippedDirs: string[]): AsyncGenerator<FileEntry> {
    let entries;
    try {
        entries = await readdir(rootDirectory, { withFileTypes: true });
    } catch {
        skippedDirs.push(rootDirectory);
        return;
    }

    for (const file of entries) {
        if (file.isDirectory()) {
            yield* getFiles(path.join(rootDirectory, file.name), skippedDirs);
        } else {
            yield { name: file.name, path: path.join(rootDirectory, file.name) };
        }
    }
}
