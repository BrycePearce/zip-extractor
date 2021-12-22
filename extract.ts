import chalk from 'chalk';
import { extract } from 'node-7z'
import { queue } from 'async';
import { getRarFilepaths, prompt } from './helper';

export const main = async () => {
    const response = await prompt(chalk.whiteBright('Enter the root and destination directories separated by a space\n'));
    const filePaths = await getRarFilepaths(`${__dirname}/Cosmic`);
    const q = queue(async (path: string, callback) => {
        await new Promise(resolve => {
            const stream = extract(path, `${__dirname}/extracted`);
            stream.on('end', () => { console.log('end'); resolve(true) })
        });
        console.log("processed", q.length())
        callback(); // todo: clean stuff up when things break
    }, 5);
    filePaths.forEach(path => q.push(path));
    q.drain(() => {
        console.log('all done')
    });
};

// process.exit(0);
main();
