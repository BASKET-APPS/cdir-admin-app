import {defineConfig} from 'vitest/config';
import path from 'node:path';
// Mediciones con el simulador de SQL Connect (no forman parte de `npm test`).
export default defineConfig({resolve:{alias:{'@':path.resolve(__dirname,'src'),'server-only':path.resolve(__dirname,'tests/server-only.ts')}},test:{include:['tests/bench/**/*.bench.test.ts'],testTimeout:600000,pool:'forks',execArgv:['--expose-gc']}});
