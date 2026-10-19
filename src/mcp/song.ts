import { runCli } from './cli';

// Entrada de `npm run song -- ...`
process.exitCode = runCli(process.argv.slice(2));
