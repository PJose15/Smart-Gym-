/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@nexera/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@nexera/ai-assist$': '<rootDir>/../../packages/ai-assist/src/index.ts',
    '^@nexera/utils$': '<rootDir>/../../packages/utils/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
};
