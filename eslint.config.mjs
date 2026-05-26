import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
    {
        plugins: { boundaries },
        settings: {
            'boundaries/include': ['src/**/*'],
            'boundaries/elements': [
                {
                    type: 'sorc-config',
                    pattern: ['src/sorc.ts', 'src/auth.ts'],
                    mode: 'file',
                },
                {
                    type: 'lib',
                    pattern: 'src/lib/*',
                    mode: 'folder',
                },
                {
                    type: 'domain',
                    pattern: 'src/domains/*',
                    mode: 'folder',
                    capture: ['domain'],
                },
                {
                    type: 'app',
                    pattern: 'src/app/**',
                    mode: 'file',
                },
                {
                    type: 'components',
                    pattern: 'src/components/**',
                    mode: 'file',
                },
                {
                    type: 'server',
                    pattern: 'src/server/**',
                    mode: 'file',
                },
            ],
        },
        rules: {
            'boundaries/dependencies': [
                'error',
                {
                    default: 'allow',
                    rules: [
                        // Domain code cannot reach into app/, components/, or server/.
                        {
                            from: { type: 'domain' },
                            disallow: [
                                { to: { type: 'app' } },
                                { to: { type: 'components' } },
                                { to: { type: 'server' } },
                            ],
                            message:
                                'Domain code may not import from app/, components/, or server/.',
                        },
                        // Domain code cannot reach into another domain's internals — only its index.ts.
                        {
                            from: {
                                type: 'domain',
                                captured: { domain: '{{from.captured.domain}}' },
                            },
                            disallow: [
                                {
                                    to: {
                                        type: 'domain',
                                        captured: {
                                            domain: '!{{from.captured.domain}}',
                                        },
                                        internalPath: '!index.{ts,tsx}',
                                    },
                                },
                            ],
                            message:
                                'Cross-domain imports must go through the target domain\'s index.ts (got: {{to.internalPath}}).',
                        },
                    ],
                },
            ],
        },
    },
]);

export default eslintConfig;
