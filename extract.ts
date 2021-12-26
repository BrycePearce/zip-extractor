import chalk from 'chalk';
import { extract } from 'node-7z'
import { existsSync } from 'fs';
import { queue } from 'async';
import readline from 'readline';
import { getRarFilepaths, prompt } from './helper';

export const main = async () => {
    const response = await prompt(chalk.whiteBright('Enter the root and destination directories separated by a space:\n'));
    const isValidIndividualOutputPath = existsSync(response);
    const pathSeparationIndex = response.lastIndexOf(':') - 2;
    let inputPath = isValidIndividualOutputPath ? process.cwd() : response.slice(0, pathSeparationIndex).trim();
    let outputPath = isValidIndividualOutputPath ? response : response.slice(pathSeparationIndex).trim();

    const isValid = [inputPath, outputPath].every(path => existsSync(path))
    if (!isValid) {
        console.log(chalk.whiteBright.bgRed.bold('\nInvalid paths provided'));
        process.exit(0);
    }

    const filePaths = await getRarFilepaths(inputPath);
    let totalProcessed = 0;
    const extractor = queue(async (path: string, callback) => {
        await new Promise(resolve => {
            const stream = extract(path, outputPath);
            stream.on('end', () => {
                totalProcessed++;
                printProgress(totalProcessed, filePaths.length);
                resolve(true);
            })
        });
        callback(); // todo: clean stuff up when things break
    }, 5);
    extractor.drain(() => {
        console.log(chalk.bold.cyan('\n\nAll done!'));
        process.exit(0);
    });

    filePaths.forEach(path => extractor.push(path));
};

const printProgress = (completed: number, total: number) => {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(chalk.bgGreenBright.blackBright(`${completed} / ${total}`));
}

main();
