import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 20000,
    hookTimeout: 40000,
    globals: true,
    root: './',
    setupFiles: [
      './src/__tests__/mongo.ts',
      './node_modules/vitest-dynamodb-lite',
      './src/__tests__/mocks.ts',
    ],
    outputFile: {
      junit: './reports/junit/test-results.xml',
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true,
        },
        target: 'es2020',
        keepClassNames: true,
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
})
