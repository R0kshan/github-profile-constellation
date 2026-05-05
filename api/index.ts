import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateConstellation } from '../lib/generateConstellation'

export default async function handler(req: VercelRequest, res: VercelResponse) {

    const allowedParams = ['username', 'terminalColor']
    const receivedParams = Object.keys(req.query)
    const hasUnknownParams = receivedParams.some(key => !allowedParams.includes(key))

    if (hasUnknownParams) {
        return res.status(400).json({ message: 'Unexpected parameters' })
    }

    const { username = '', terminalColor = '#96C7FF' } = req.query
    const usernameStr = username as string
    const colorStr = (terminalColor as string).replace(/^%23/, '#')

    if (!usernameStr) {
        return res.status(400).json({ message: 'Username query parameter is required' })
    }

    if (!/^[a-zA-Z0-9-]{1,39}$/.test(usernameStr)) {
        return res.status(400).json({ message: 'Invalid GitHub username' })
    }

    if (!/^#[0-9a-fA-F]{3,6}$/.test(colorStr)) {
        return res.status(400).json({ message: 'Invalid color, use hex format e.g. #96C7FF' })
    }

    try {
        const svg = await generateConstellation(usernameStr, colorStr)
        res.setHeader('Content-Type', 'image/svg+xml')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        return res.send(svg)
    } catch (e) {
        return res.status(500).json({ message: 'Failed to generate constellation' })
    }
}