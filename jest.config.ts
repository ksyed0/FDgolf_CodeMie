import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/app/api/**/*.ts',
    // excluded: infrastructure wrappers and generated utilities have no logic to unit-test
    '!src/lib/supabase/**/*.ts',
    '!src/lib/utils.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/__tests__/**/*.test.tsx',
  ],
}

export default createJestConfig(config)
