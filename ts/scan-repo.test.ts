import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scanFiles,
  getBasename,
  isBinary,
  getFilesRecursive,
  main,
} from './scan-repo'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { spawnSync } from 'child_process'
import { join, resolve } from 'path'
import { tmpdir } from 'os'

const CLI_PATH = resolve(import.meta.dirname, 'scan-repo.ts')
const PROJECT_ROOT = resolve(import.meta.dirname, '..')

function runScanRepo(
  args: string[],
  options: { cwd?: string } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('npx', ['tsx', CLI_PATH, ...args], {
    encoding: 'utf-8',
    cwd: options.cwd ?? PROJECT_ROOT,
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  }
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'bip39-scan-'))
}

describe('scanFiles', () => {
  it('detects seed phrase in a file', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'secrets.txt'), 'abandon ability able about above')
    const result = scanFiles([join(dir, 'secrets.txt')])
    expect(result).toHaveLength(1)
    expect(result[0].file).toContain('secrets.txt')
    expect(result[0].matchedWords).toHaveLength(5)
  })

  it('returns empty for clean files', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'clean.txt'), 'hello world this is fine')
    const result = scanFiles([join(dir, 'clean.txt')])
    expect(result).toEqual([])
  })

  it('scans multiple files', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'a.txt'), 'abandon ability able about above')
    writeFileSync(join(dir, 'b.txt'), 'normal content here')
    writeFileSync(join(dir, 'c.txt'), 'zoo zone zero youth young you')
    const result = scanFiles([
      join(dir, 'a.txt'),
      join(dir, 'b.txt'),
      join(dir, 'c.txt'),
    ])
    expect(result).toHaveLength(2)
  })

  it('respects custom threshold', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'test.txt'), 'abandon ability able about above')
    expect(scanFiles([join(dir, 'test.txt')], 6)).toEqual([])
    expect(scanFiles([join(dir, 'test.txt')], 5)).toHaveLength(1)
  })

  it('skips binary files gracefully', () => {
    const dir = makeTempDir()
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])
    writeFileSync(join(dir, 'binary.bin'), buf)
    const result = scanFiles([join(dir, 'binary.bin')])
    expect(result).toEqual([])
  })
})

describe('getBasename', () => {
  it('extracts basename from a path with slashes', () => {
    expect(getBasename('src/utils/file.ts')).toBe('file.ts')
  })

  it('returns the full string when no slashes present', () => {
    expect(getBasename('file.ts')).toBe('file.ts')
  })
})

describe('isBinary', () => {
  it('returns true for content with null bytes', () => {
    expect(isBinary('hello\0world')).toBe(true)
  })

  it('returns false for normal text', () => {
    expect(isBinary('hello world')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isBinary('')).toBe(false)
  })
})

describe('getFilesRecursive', () => {
  it('returns all files in a directory', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'a.txt'), 'hello')
    writeFileSync(join(dir, 'b.txt'), 'world')
    const files = getFilesRecursive(dir)
    expect(files).toHaveLength(2)
    expect(files.some((f) => f.endsWith('a.txt'))).toBe(true)
    expect(files.some((f) => f.endsWith('b.txt'))).toBe(true)
  })

  it('recurses into subdirectories', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'top.txt'), 'top')
    writeFileSync(join(dir, 'sub', 'nested.txt'), 'nested')
    const files = getFilesRecursive(dir)
    expect(files).toHaveLength(2)
    expect(files.some((f) => f.endsWith('nested.txt'))).toBe(true)
  })

  it('skips .git and node_modules directories', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, '.git'))
    mkdirSync(join(dir, 'node_modules'))
    writeFileSync(join(dir, '.git', 'config'), 'git stuff')
    writeFileSync(join(dir, 'node_modules', 'pkg.json'), '{}')
    writeFileSync(join(dir, 'real.txt'), 'real file')
    const files = getFilesRecursive(dir)
    expect(files).toHaveLength(1)
    expect(files[0]).toContain('real.txt')
  })
})

describe('scan-repo main() in-process', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let origArgv: string[]

  beforeEach(() => {
    origArgv = process.argv
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    process.argv = origArgv
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
    stdoutSpy.mockRestore()
  })

  it('exits 1 when seed phrases found in --dir mode', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'seed.txt'),
      'abandon ability able about above absent absorb abstract\n',
    )
    process.argv = ['node', 'scan-repo.ts', '--dir', dir]
    main()
    expect(exitSpy).toHaveBeenCalledWith(1)
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('BIP39')
  })

  it('exits 0 when files are clean in --dir mode', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'clean.txt'), 'hello world\n')
    process.argv = ['node', 'scan-repo.ts', '--dir', dir]
    main()
    expect(exitSpy).toHaveBeenCalledWith(0)
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('No BIP39')
  })

  it('--json outputs valid JSON to stdout', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'seed.txt'),
      'abandon ability able about above absent absorb abstract\n',
    )
    process.argv = ['node', 'scan-repo.ts', '--dir', dir, '--json']
    main()
    expect(exitSpy).toHaveBeenCalledWith(1)
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('')
    const parsed = JSON.parse(output)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('--json outputs empty array for clean dir', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'clean.txt'), 'nothing here\n')
    process.argv = ['node', 'scan-repo.ts', '--dir', dir, '--json']
    main()
    expect(exitSpy).toHaveBeenCalledWith(0)
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('')
    expect(JSON.parse(output)).toEqual([])
  })

  it('--threshold raises detection bar', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'mild.txt'),
      'abandon ability able about above absent\n',
    )
    process.argv = ['node', 'scan-repo.ts', '--dir', dir, '--threshold', '12']
    main()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('--ignore skips matching files', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'dump.sql'),
      'abandon ability able about above absent absorb abstract\n',
    )
    process.argv = ['node', 'scan-repo.ts', '--dir', dir, '--ignore', '*.sql']
    main()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('skips lockfiles by default', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'package-lock.json'),
      'abandon ability able about above absent absorb abstract\n',
    )
    process.argv = ['node', 'scan-repo.ts', '--dir', dir]
    main()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('--include-lockfiles scans lockfiles', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'package-lock.json'),
      'abandon ability able about above absent absorb abstract\n',
    )
    process.argv = ['node', 'scan-repo.ts', '--dir', dir, '--include-lockfiles']
    main()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

describe('scan-repo CLI (subprocess)', () => {
  it('exits 1 and reports BIP39 when seed phrases present', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'secrets.txt'),
      'abandon ability able about above absent absorb abstract',
    )
    const { exitCode, stderr } = runScanRepo(['--dir', dir])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('BIP39')
  })

  it('exits 0 and reports no BIP39 when files are clean', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'clean.txt'), 'hello world nothing to see here')
    const { exitCode, stderr } = runScanRepo(['--dir', dir])
    expect(exitCode).toBe(0)
    expect(stderr).toContain('No BIP39')
  })

  it('--json outputs valid JSON array on stdout', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'seed.txt'),
      'abandon ability able about above absent absorb abstract',
    )
    const { stdout, exitCode } = runScanRepo(['--dir', dir, '--json'])
    expect(exitCode).toBe(1)
    const parsed = JSON.parse(stdout)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0]).toHaveProperty('matchedWords')
  })

  it('--json outputs empty array for clean directory', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'clean.txt'), 'nothing here')
    const { stdout, exitCode } = runScanRepo(['--dir', dir, '--json'])
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout)).toEqual([])
  })

  it('--threshold raises the bar for detection', () => {
    const dir = makeTempDir()
    // 6 consecutive BIP39 words — default threshold (5) would catch this
    writeFileSync(
      join(dir, 'mild.txt'),
      'abandon ability able about above absent',
    )
    const { exitCode } = runScanRepo(['--dir', dir, '--threshold', '12'])
    expect(exitCode).toBe(0)
  })

  it('--ignore skips matching files', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'dump.sql'),
      'abandon ability able about above absent absorb abstract',
    )
    const { exitCode } = runScanRepo(['--dir', dir, '--ignore', '*.sql'])
    expect(exitCode).toBe(0)
  })

  it('skips lockfiles by default', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'package-lock.json'),
      'abandon ability able about above absent absorb abstract',
    )
    const { exitCode } = runScanRepo(['--dir', dir])
    expect(exitCode).toBe(0)
  })

  it('--include-lockfiles scans lockfiles', () => {
    const dir = makeTempDir()
    writeFileSync(
      join(dir, 'package-lock.json'),
      'abandon ability able about above absent absorb abstract',
    )
    const { exitCode } = runScanRepo(['--dir', dir, '--include-lockfiles'])
    expect(exitCode).toBe(1)
  })
})
