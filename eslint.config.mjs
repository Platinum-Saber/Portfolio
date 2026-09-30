import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
      // Cloudflare / OpenNext build output - generated bundles, thousands of
      // findings that are not ours. Same list as .gitignore.
      '.open-next/**',
      '.wrangler/**',
      // Local scratch, gitignored.
      '_to_delete/**',
      // Deno runtime, linted by `deno lint` if at all.
      'supabase/functions/**',
    ],
  },
];

export default config;
