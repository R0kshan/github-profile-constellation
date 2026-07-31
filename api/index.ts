import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateConstellation, normalizeHexColor } from '../lib/generateConstellation.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {

    const allowedParams = ['username', 'tuiColor', 'showStargazers', 'showBorders', 'fontFamily', 'fontSize']
    const receivedParams = Object.keys(req.query)
    const hasUnknownParams = receivedParams.some(key => !allowedParams.includes(key))

    if (hasUnknownParams) {
        return res.status(400).json({ message: 'Unexpected parameters' })
    }

    const { username = '', tuiColor = '#318a80', showStargazers = '1', showBorders = '1', fontFamily = 'Consolas', fontSize = '14' } = req.query
    const usernameStr = username as string
    const tuiColorStr = normalizeHexColor(tuiColor as string)
    const stargazersBool = (showStargazers as string) !== '0'
    const bordersBool = (showBorders as string) !== '0'
    const fontFamilyStr = fontFamily as string
    const fontSizeNum = Math.min(Math.max(parseInt(fontSize as string, 10), 8), 40)

    if (!usernameStr) {
        return res.status(400).json({ message: 'Username query parameter is required' })
    }

    if (!/^[a-zA-Z0-9-]{1,39}$/.test(usernameStr)) {
        return res.status(400).json({ message: 'Invalid GitHub username' })
    }

    if (!/^#[0-9a-fA-F]{3,6}$/.test(tuiColorStr)) {
        return res.status(400).json({ message: 'Invalid color, use hex format e.g. 318a80' })
    }

    if (!/^[01]$/.test(showStargazers as string) || !/^[01]$/.test(showBorders as string)) {
        return res.status(400).json({ message: 'showStargazers and showBorders must be 0 or 1' })
    }

    if (!/^[a-zA-Z0-9 ,'"-]{1,50}$/.test(fontFamilyStr)) {
        return res.status(400).json({ message: 'Invalid fontFamily' })
    }

    if (!/^\d{1,2}$/.test(fontSize as string)) {
        return res.status(400).json({ message: 'Invalid fontSize' })
    }

    try {
        const svg = await generateConstellation(usernameStr, stargazersBool, bordersBool, tuiColorStr, fontFamilyStr, fontSizeNum)
        res.setHeader('Content-Type', 'image/svg+xml')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        return res.send(svg)
    } catch {
        return res.status(500).json({ message: 'Failed to generate constellation' })
    }
}