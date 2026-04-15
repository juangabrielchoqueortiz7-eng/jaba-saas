import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['src']
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
])

const suspiciousPatterns = [
  { label: 'latin1/utf8 mojibake', pattern: /[\u00c2\u00c3]/ },
  { label: 'emoji mojibake', pattern: /\u00f0\u0178/ },
  { label: 'punctuation mojibake', pattern: /\u00e2[\u0080-\u00bf]/ },
  { label: 'replacement character', pattern: /\ufffd/ },
]

const findings = []

function scanFile(filePath) {
  const ext = path.extname(filePath)
  if (!TEXT_EXTENSIONS.has(ext)) return

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line, index) => {
    const match = suspiciousPatterns.find(({ pattern }) => pattern.test(line))
    if (match) {
      findings.push({
        filePath,
        lineNumber: index + 1,
        label: match.label,
        line: line.trim(),
      })
    }
  })
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath)
    } else {
      scanFile(entryPath)
    }
  }
}

ROOTS.forEach(walk)

if (findings.length > 0) {
  console.error('Encoding check failed. Suspicious mojibake found:')
  for (const finding of findings) {
    console.error(`${finding.filePath}:${finding.lineNumber} [${finding.label}] ${finding.line}`)
  }
  process.exit(1)
}

console.log('Encoding check passed.')
