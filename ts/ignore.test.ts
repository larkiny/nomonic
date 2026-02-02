import { describe, it, expect } from 'vitest'
import { tmpdir } from 'os'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { loadIgnorePatterns, compilePattern, isIgnored } from './ignore'

describe('loadIgnorePatterns', () => {
  it('returns empty array when file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nomonic-'))
    expect(loadIgnorePatterns(dir)).toEqual([])
  })

  it('reads patterns from .nomonicignore', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nomonic-'))
    writeFileSync(join(dir, '.nomonicignore'), 'drizzle/migrations/**\n*.sql\n')
    expect(loadIgnorePatterns(dir)).toEqual([
      'drizzle/migrations/**',
      '*.sql',
    ])
  })

  it('strips comments and blank lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nomonic-'))
    writeFileSync(
      join(dir, '.nomonicignore'),
      '# This is a comment\n\ndrizzle/**\n  # indented comment\n\nvendor/\n',
    )
    expect(loadIgnorePatterns(dir)).toEqual(['drizzle/**', 'vendor/'])
  })

  it('trims whitespace from patterns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nomonic-'))
    writeFileSync(join(dir, '.nomonicignore'), '  foo/**  \n  bar.sql  \n')
    expect(loadIgnorePatterns(dir)).toEqual(['foo/**', 'bar.sql'])
  })
})

describe('compilePattern', () => {
  describe('simple filename glob', () => {
    it('*.sql matches any .sql file at any depth', () => {
      const pat = compilePattern('*.sql')
      expect(pat.test('foo.sql')).toBe(true)
      expect(pat.test('db/foo.sql')).toBe(true)
      expect(pat.test('a/b/c/foo.sql')).toBe(true)
      expect(pat.test('foo.ts')).toBe(false)
    })
  })

  describe('directory glob with *', () => {
    it('drizzle/migrations/* matches files directly inside', () => {
      const pat = compilePattern('drizzle/migrations/*')
      expect(pat.test('drizzle/migrations/0001.sql')).toBe(true)
      expect(pat.test('drizzle/migrations/0002_init.sql')).toBe(true)
      // * does not cross /
      expect(pat.test('drizzle/migrations/sub/deep.sql')).toBe(false)
    })
  })

  describe('double-star **', () => {
    it('drizzle/** matches everything under drizzle/', () => {
      const pat = compilePattern('drizzle/**')
      expect(pat.test('drizzle/migrations/0001.sql')).toBe(true)
      expect(pat.test('drizzle/schema.ts')).toBe(true)
      expect(pat.test('drizzle/a/b/c/deep.sql')).toBe(true)
      expect(pat.test('src/drizzle/foo.ts')).toBe(true)
    })

    it('**/migrations/*.sql matches migrations at any depth', () => {
      const pat = compilePattern('**/migrations/*.sql')
      expect(pat.test('drizzle/migrations/0001.sql')).toBe(true)
      expect(pat.test('migrations/0001.sql')).toBe(true)
      expect(pat.test('a/b/migrations/foo.sql')).toBe(true)
      expect(pat.test('migrations/sub/foo.sql')).toBe(false)
    })
  })

  describe('anchored patterns (leading /)', () => {
    it('/vendor/* matches only at repo root', () => {
      const pat = compilePattern('/vendor/*')
      expect(pat.test('vendor/lib.js')).toBe(true)
      expect(pat.test('src/vendor/lib.js')).toBe(false)
    })
  })

  describe('trailing slash (directory)', () => {
    it('migrations/ matches anything under migrations/', () => {
      const pat = compilePattern('migrations/')
      expect(pat.test('migrations/0001.sql')).toBe(true)
      expect(pat.test('migrations/sub/deep.sql')).toBe(true)
      expect(pat.test('drizzle/migrations/0001.sql')).toBe(true)
    })
  })

  describe('? wildcard', () => {
    it('matches single non-slash character', () => {
      const pat = compilePattern('file?.txt')
      expect(pat.test('file1.txt')).toBe(true)
      expect(pat.test('fileA.txt')).toBe(true)
      expect(pat.test('file12.txt')).toBe(false)
      expect(pat.test('file/.txt')).toBe(false)
    })
  })

  describe('special regex characters in pattern', () => {
    it('handles dots in patterns', () => {
      const pat = compilePattern('*.config.js')
      expect(pat.test('eslint.config.js')).toBe(true)
      expect(pat.test('eslintXconfigXjs')).toBe(false)
    })
  })
})

describe('isIgnored', () => {
  it('returns false when no patterns match', () => {
    const patterns = ['*.sql', 'vendor/**'].map(compilePattern)
    expect(isIgnored('src/index.ts', patterns)).toBe(false)
  })

  it('returns true when any pattern matches', () => {
    const patterns = ['*.sql', 'vendor/**'].map(compilePattern)
    expect(isIgnored('db/schema.sql', patterns)).toBe(true)
    expect(isIgnored('vendor/lib/util.js', patterns)).toBe(true)
  })

  it('returns false with empty patterns', () => {
    expect(isIgnored('anything.ts', [])).toBe(false)
  })
})
