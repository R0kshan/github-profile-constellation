import type { VercelRequest, VercelResponse } from '@vercel/node'
const { generateConstellation } = require('../lib/generateConstellation')

export default async function handler(req: VercelRequest, res: VercelResponse) {

    const { username = 'R0kshan', terminalColor = '#96C7FF' } = req.query
    const svg = await generateConstellation(username as string, terminalColor as string)

    res.setHeader('Content-Type', 'image/svg+xml')
    return res.send(svg);
}