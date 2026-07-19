/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
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
