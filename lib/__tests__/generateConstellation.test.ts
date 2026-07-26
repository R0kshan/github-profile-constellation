import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateConstellation } from '../generateConstellation'

const FIXTURES = resolve(__dirname, '__fixtures__')

const MOCK_TIMESTAMP = 1_725_000_000_000

function mockResponse(data: unknown, asText = false) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(asText ? (data as string) : JSON.stringify(data)),
  }
}

describe('generateConstellation', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(MOCK_TIMESTAMP))

    const user = JSON.parse(readFileSync(resolve(FIXTURES, 'user.json'), 'utf-8'))
    const repos = JSON.parse(readFileSync(resolve(FIXTURES, 'repos.json'), 'utf-8'))
    const starred = JSON.parse(readFileSync(resolve(FIXTURES, 'starred.json'), 'utf-8'))
    const linguistYml = readFileSync(resolve(FIXTURES, 'linguist.yml'), 'utf-8')

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('api.github.com/users/') && !url.includes('/repos') && !url.includes('/starred')) {
        return Promise.resolve(mockResponse(user))
      }
      if (url.includes('/repos')) {
        return Promise.resolve(mockResponse(repos))
      }
      if (url.includes('/starred')) {
        return Promise.resolve(mockResponse(starred))
      }
      if (url.includes('raw.githubusercontent.com')) {
        return Promise.resolve(mockResponse(linguistYml, true))
      }
      return Promise.resolve(mockResponse({}))
    }))
  })

  it('generates deterministic SVG output for testuser', async () => {
    const svg = await generateConstellation('testuser', '#96C7FF')
    const fixturePath = resolve(FIXTURES, 'expected.svg')
    await expect(svg).toMatchFileSnapshot(fixturePath)
  })
})
