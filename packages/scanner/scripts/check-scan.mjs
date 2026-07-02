import { scanProject } from '../dist/index.js';

const target = process.argv[2] ?? process.cwd();

const result = await scanProject(target);

console.log(JSON.stringify(result, null, 2));
