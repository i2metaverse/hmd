/**
 * This is the Vite configuration file for the project.
 * - it is mts to explicitly indiate it should be processed as
 *   a ECMAScript module (and not a CommonJS module)
 */

/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
    test: {
        reporters: ['verbose'],
        setupFiles: ['./vitest.setup.ts'],
        environment: 'jsdom',
        deps: {
            optimizer: {
                web: {
                    include: ['vitest-canvas-mock'],
                }
            }
        },
        environmentOptions: {
            jsdom: {
                resources: 'usable',
            },
        },
        testTimeout: 60000,
    },
    build: {
        outDir: 'docs'
    },
    base: '/dia-playground/',
});
