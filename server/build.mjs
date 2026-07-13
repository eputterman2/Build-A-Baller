import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Bundle the server + shared TS into a single CJS file. node_modules stay
// external (installed in the production image), our own source is inlined.
await esbuild.build({
  entryPoints: [resolve(here, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: resolve(here, 'dist/index.js'),
  packages: 'external',
  sourcemap: true,
  alias: {
    '@shared/index': resolve(here, '../shared/src/index.ts'),
  },
  logLevel: 'info',
});
