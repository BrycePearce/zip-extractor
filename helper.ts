import { readdir } from 'fs/promises';
import path from 'path';
import readline from 'readline';

export const prompt = async (query: string) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const response = await new Promise<string>((resolve) => rl.question(query, resolve));
    rl.close();
    return response;
}

export const getRarFilepaths = async (directoryPath: string): Promise<string[]> => {
    const filepaths = [];
    for await (const file of getFiles(directoryPath)) {
        const isRar = [".rar", ".7z"].includes(file.name.slice(file.name.lastIndexOf(".")));
        if (isRar) filepaths.push(file.path);
    }
    return filepaths;
}

async function* getFiles(rootDirectory: string): any {
    const entries = await readdir(rootDirectory, { withFileTypes: true });

    for (const file of entries) {
        if (file.isDirectory()) {
            yield* getFiles(path.join(rootDirectory, file.name));
        } else {
            yield { ...file, path: path.join(rootDirectory, file.name) };
        }
    }
}