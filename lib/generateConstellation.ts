import jsyaml from 'js-yaml'
import seedrandom from 'seedrandom'

import type { GitHubUser } from './types/GitHubUser.js'
import type { GitHubRepo } from './types/GitHubRepo.js'
import type { LinguistEntry } from './types/LinguistEntry.js'
import type { ConstellationNode } from './types/ConstellationNode.js'

async function fetchStarredPages(initialRes: Response, fetchInit: RequestInit | undefined): Promise<GitHubRepo[]> {
    if (!initialRes.ok) return [];
    const items: GitHubRepo[] = await initialRes.json();
    const linkHeader = initialRes.headers.get('link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    if (!nextMatch) return items;
    let url = nextMatch[1];
    while (url) {
        const res = await fetch(url, fetchInit);
        if (!res.ok) break;
        items.push(...await res.json());
        const nextLink = res.headers.get('link');
        const nextLinkMatch = nextLink?.match(/<([^>]+)>;\s*rel="next"/);
        url = nextLinkMatch ? nextLinkMatch[1] : '';
    }
    return items;
}

function genRgbColorFromStargazerCount(count: number): string {
    const progressiveBlueness = Math.log10(count + 1);
    const intensity = Math.min(progressiveBlueness / 3, 1);
    const rVal = Math.floor(255 - (255 * intensity));
    const gVal = Math.floor(255 - (13 * intensity));
    const bVal = 255;
    return `rgb(${rVal}, ${gVal}, ${bVal})`;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function normalizeHexColor(value: string): string {
    const hex = value.replace(/^%23/, '');
    return hex.startsWith('#') ? hex : `#${hex}`;
}

function estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * 0.6;
}

function splitOversizedPart(part: string, fontSize: number, maxWidth: number): string[] {
    const chunks: string[] = [];
    let current = '';
    let index = 0;
    while (index < part.length) {
        let unit = part[index];
        if (part[index] === '&') {
            const entityEnd = part.indexOf(';', index);
            if (entityEnd !== -1) unit = part.slice(index, entityEnd + 1);
        }
        if (current && estimateTextWidth(current + unit, fontSize) > maxWidth) {
            chunks.push(current);
            current = unit;
        } else {
            current += unit;
        }
        index += unit.length;
    }
    if (current) chunks.push(current);
    return chunks;
}

function wrapValue(text: string, fontSize: number, maxWidth: number, separator: string = ' • '): string[] {
    const lines: string[] = [];
    let current = '';
    for (const part of text.split(separator)) {
        const candidate = current ? `${current}${separator}${part}` : part;
        if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) lines.push(current);
        current = '';
        if (estimateTextWidth(part, fontSize) <= maxWidth) {
            current = part;
        } else {
            lines.push(...splitOversizedPart(part, fontSize, maxWidth));
        }
    }
    if (current) lines.push(current);
    return lines;
}

function computeMstEdges(nodes: ConstellationNode[]): { i: number; j: number; d: number }[] {
    const edges: { i: number; j: number; d: number }[] = [];
    const connected = [0];
    const unreachable = [...Array(nodes.length).keys()].slice(1);

    while (unreachable.length > 0) {
        const pairs = connected.flatMap(i =>
            unreachable.map((toIdx, j) => ({ i, j, d: Math.hypot(nodes[i].x - nodes[toIdx].x, nodes[i].y - nodes[toIdx].y) }))
        );
        const best = pairs.reduce((min, p) => p.d < min.d ? p : min);

        edges.push({ i: best.i, j: unreachable[best.j], d: best.d });

        connected.push(unreachable[best.j]);
        unreachable.splice(best.j, 1);
    }
    return edges;
}

function lightenColor(hex: string, amount: number): string {
    const normalized = hex.replace(/^#/, '');
    const full = normalized.length === 3
        ? normalized.split('').map(ch => ch + ch).join('')
        : normalized;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
    const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
    return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

async function generateConstellation(userName: string, showStargazers: boolean = true, showBorders: boolean = true, tuiColor: string = '#318a80', fontFamily: string = 'Consolas', fontSize: number = 14): Promise<string> {
    const canvasWidth = 1000;
    const canvasHeight = 400;

    const constellationCenterX = (canvasWidth / 2) + 40;
    const constellationCenterY = (canvasHeight / 2) - 10;

    const leftPanelRightX = 300;
    const chartValueX = 160;
    const maxBrightestStarsLines = 3;
    const constellationPanelRightX = canvasWidth - 15;
    const viewportX = leftPanelRightX + 14;
    const viewportY = 20;
    const viewportWidth = constellationPanelRightX - viewportX;
    const viewportHeight = 330;
    const viewportPadding = 20;
    const viewportCenterX = viewportX + viewportWidth / 2;
    const viewportCenterY = viewportY + viewportHeight / 2;

    const headerColor = lightenColor(tuiColor, 0.3);
    const labelColor = lightenColor(tuiColor, 0.5);
    const valueColor = lightenColor(tuiColor, 0.8);

    const fetchInit: RequestInit | undefined = process.env.GITHUB_TOKEN
        ? { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
        : undefined

    const [userRes, reposRes, linguistRes, starredRes] = await Promise.all([
        fetch(`https://api.github.com/users/${userName}`, fetchInit),
        fetch(`https://api.github.com/users/${userName}/repos?per_page=100&sort=updated`, fetchInit),
        fetch(`https://raw.githubusercontent.com/github-linguist/linguist/master/lib/linguist/languages.yml`, fetchInit),
        fetch(`https://api.github.com/users/${userName}/starred?per_page=100`, fetchInit)
    ]);

    if (!userRes.ok) throw new Error(`GitHub user API returned ${userRes.status}`);
    if (!reposRes.ok) throw new Error(`GitHub repos API returned ${reposRes.status}`);
    if (!linguistRes.ok) throw new Error(`Linguist API returned ${linguistRes.status}`);
    const userInfo: GitHubUser = await userRes.json();
    const repos: GitHubRepo[] = await reposRes.json();
    const linguist = jsyaml.load(await linguistRes.text()) as Record<string, LinguistEntry>;

    const starred = await fetchStarredPages(starredRes, fetchInit);

    const currentMostUsedLangInTheWorld = "Python";

    const languageCountKeyValueMap: Record<string, number> = {};
    repos.filter(repo => repo.language).forEach(repo => {
        languageCountKeyValueMap[repo.language!] = (languageCountKeyValueMap[repo.language!] || 0) + 1;
    });

    const topThreeLanguages = Object.entries(languageCountKeyValueMap)
        .sort((currentEntry, nextEntry) => nextEntry[1] - currentEntry[1])
        .slice(0, 3)
        .map(entry => entry[0]);

    const languageColors: Record<string, string> = {};
    Object.entries(linguist)
        .filter(([, entry]) => entry.color)
        .forEach(([lang, entry]) => { languageColors[lang] = entry.color as string; });

    const primaryLangColor = languageColors[topThreeLanguages[0]] || languageColors[currentMostUsedLangInTheWorld] || "#ffffff";
    const secondLangColor = languageColors[topThreeLanguages[1]] || languageColors[currentMostUsedLangInTheWorld] || "#ffffff";
    const thirdLangColor = languageColors[topThreeLanguages[2]] || languageColors[currentMostUsedLangInTheWorld] || "#ffffff";

    const followers = userInfo.followers || 0;
    const floatDur = Math.max(3, 12 - Math.log10(followers + 1) * 3);

    const constellationNodesCount = repos.length;

    const randNumGen = seedrandom(`${userName}-${userInfo.id}`);

    const getConstellation = (scale: number, xOff: number, yOff: number): ConstellationNode[] => {
        const constellation = (repos && repos.length ? repos : Array(constellationNodesCount).fill({})) as GitHubRepo[];

        return constellation.map((repo: GitHubRepo, currentRepoIndex: number) => {
            const constellationRandNumGen = seedrandom(`${repo.size}-${repo.id}-${repo.created_at}-${repo.node_id}`);
            const deterministicHash = constellationRandNumGen();

            const radius = (40 + (Math.pow(deterministicHash, 1.4) * 110)) * scale;
            const angle = (currentRepoIndex * Math.PI * 2) / constellation.length - Math.PI / 2;
            const rawX = constellationCenterX + xOff + radius * Math.cos(angle);
            const rawY = constellationCenterY + yOff + (radius * Math.sin(angle) * 0.6);

            const prevAngle = ((currentRepoIndex - 1) * Math.PI * 2) / constellation.length - Math.PI / 2;
            const prevRadius = (40 + (Math.pow(seedrandom(`${constellation[Math.max(0, currentRepoIndex - 1)].size}-${constellation[Math.max(0, currentRepoIndex - 1)].id}-${constellation[Math.max(0, currentRepoIndex - 1)].created_at}-${constellation[Math.max(0, currentRepoIndex - 1)].node_id}`)(), 1.4) * 110)) * scale;
            const prevX = constellationCenterX + xOff + prevRadius * Math.cos(prevAngle);
            const tooClose = Math.abs(rawX - prevX) < 5;
            const x = tooClose ? rawX + (deterministicHash > 0.5 ? 15 : -15) : rawX;
            const y = rawY;

            return {
                x,
                y,
                colorFromRepoLang: (repo.language && languageColors[repo.language]) ? languageColors[repo.language] : "#ffffff",
                stargazerIntensity: 3 + (repo.stargazers_count * 0.002),
                colorFromRepoStargazer: genRgbColorFromStargazerCount(repo.stargazers_count || 0)
            };
        });
    };

    let constellation = getConstellation(2, 0, 0);
    let mstEdges = computeMstEdges(constellation);
    const maxEdgeDistance = mstEdges.length ? Math.max(...mstEdges.map(edge => edge.d)) : 0;
    if (maxEdgeDistance > canvasWidth * 0.35) {
        const scaleFactor = (canvasWidth * 0.35 * 0.98) / maxEdgeDistance;
        constellation = constellation.map(node => ({
            ...node,
            x: constellationCenterX + (node.x - constellationCenterX) * scaleFactor,
            y: constellationCenterY + (node.y - constellationCenterY) * scaleFactor
        }));
        mstEdges = computeMstEdges(constellation);
    }

    const fitXs = constellation.map(n => n.x);
    const fitYs = constellation.map(n => n.y);
    const bboxWidth = fitXs.length ? Math.max(...fitXs) - Math.min(...fitXs) : 0;
    const bboxHeight = fitYs.length ? Math.max(...fitYs) - Math.min(...fitYs) : 0;
    const maxNodeRadius = constellation.length ? Math.max(...constellation.map(n => n.stargazerIntensity)) : 0;
    const fitScale = Math.min(
        (viewportWidth - 2 * (viewportPadding + maxNodeRadius)) / bboxWidth,
        (viewportHeight - 2 * (viewportPadding + maxNodeRadius)) / bboxHeight,
        1
    );
    if (fitScale < 1) {
        constellation = constellation.map(node => ({
            ...node,
            x: constellationCenterX + (node.x - constellationCenterX) * fitScale,
            y: constellationCenterY + (node.y - constellationCenterY) * fitScale
        }));
        mstEdges = computeMstEdges(constellation);
    }

    const xs = constellation.map(n => n.x);
    const ys = constellation.map(n => n.y);
    const bboxCenterX = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : viewportCenterX;
    const bboxCenterY = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : viewportCenterY;
    const translateX = viewportCenterX - bboxCenterX;
    const translateY = viewportCenterY - bboxCenterY;

    const connectionLines = mstEdges
        .filter(edge => edge.d < canvasWidth * 0.35)
        .map(edge => {
            const x1 = constellation[edge.i].x;
            const y1 = constellation[edge.i].y;
            const x2 = constellation[edge.j].x;
            const y2 = constellation[edge.j].y;

            return `
            <g filter="url(#thirdLangGlow)">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="${thirdLangColor}" stroke-width="20" stroke-opacity="0.07">
                    <animate attributeName="opacity" values="0.05;0.1;0.05" dur="3s" repeatCount="indefinite" />
                </line>
            </g>

            <g filter="url(#secondLangGlow)">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="${secondLangColor}" stroke-width="5" stroke-opacity="0.07">
                    <animate attributeName="opacity" values="0.05;0.1;0.05" dur="3s" repeatCount="indefinite" />
                </line>
            </g>

            <g filter="url(#softGlow)">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="${primaryLangColor}" stroke-width="2" stroke-opacity="0.8">
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
                </line>
            </g>
        `;
        })
        .join('\n');

    const stars = starred.map(star => {
        const count = star.stargazers_count || 0;
        const intensity = Math.min(Math.log10(count + 1) / 3, 1);
        const dynamicColor = genRgbColorFromStargazerCount(star.stargazers_count || 0);

        const xPos = randNumGen() * canvasWidth;
        const yPos = randNumGen() * canvasHeight;
        const radius = 0.5 + (intensity * 2.5);
        const animDuration = 2 + randNumGen() * 4;
        return `<circle cx="${xPos}" cy="${yPos}" r="${radius}" fill="${dynamicColor}" opacity="0.8">
            <animate attributeName="opacity" values="0.1;0.7;0.1" dur="${animDuration}s" repeatCount="indefinite" />
        </circle>`;
    }).join('');

    const nodes = constellation.map((node) => {
        const animationRadius = 1.5;
        const twinkleDuration = 1.5 + randNumGen() + node.stargazerIntensity;
        return `<circle cx="${node.x}" cy="${node.y}" r="${node.stargazerIntensity}" fill="${node.colorFromRepoStargazer}">
                <animate attributeName="r" values="${animationRadius};${node.stargazerIntensity};${animationRadius}" dur="${twinkleDuration}s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;1;0.5" dur="${twinkleDuration}s" repeatCount="indefinite" />
                </circle>
                `;
    }).join('');

    const displayName = escapeXml(userInfo.name || userName);
    const profileUrl = escapeXml(`github.com/${userName}`);
    const visibleNodes = repos.length;

    const brightestStars = escapeXml(
        repos
            .filter(r => (r.stargazers_count || 0) >= 1)
            .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
            .slice(0, 3)
            .map(r => `${r.name} (${r.stargazers_count || 0})`)
            .join(' • ') || '—'
    );

    const totalLuminosity = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    const stellarComposition = escapeXml(topThreeLanguages.slice(0, 3).join(' • ') || '—');

    const coordinatesNeedWrap = estimateTextWidth(profileUrl, fontSize) > leftPanelRightX - chartValueX;
    const brightestStarsNeedWrap = estimateTextWidth(brightestStars, fontSize - 1) > leftPanelRightX - 45;
    const unwrappedBrightestStarsLines = brightestStarsNeedWrap
        ? wrapValue(brightestStars, fontSize - 1, leftPanelRightX - 45)
        : [brightestStars];
    const brightestStarsLines = unwrappedBrightestStarsLines.length > maxBrightestStarsLines
        ? [...unwrappedBrightestStarsLines.slice(0, maxBrightestStarsLines - 1), `${unwrappedBrightestStarsLines[maxBrightestStarsLines - 1]}...`]
        : unwrappedBrightestStarsLines;

    const chartRows = coordinatesNeedWrap ? `
            <text x="30" y="83" class="label">Coordinates:</text>
            <text x="45" y="105" class="value-indent">${profileUrl}</text>

            <text x="30" y="133" class="label">Visible stars:</text>
            <text x="${chartValueX}" y="133" class="value">${visibleNodes}</text>` : `
            <text x="30" y="83" class="label">Coordinates:</text>
            <text x="${chartValueX}" y="83" class="value">${profileUrl}</text>

            <text x="30" y="111" class="label">Visible stars:</text>
            <text x="${chartValueX}" y="111" class="value">${visibleNodes}</text>`;

    const profileRowLines = [
        `<text x="30" y="${brightestStarsNeedWrap ? 198 : 212}" class="label">Main composition:</text>`,
        `<text x="45" y="${brightestStarsNeedWrap ? 220 : 234}" class="value-indent">${stellarComposition}</text>`
    ];
    if (showStargazers) {
        profileRowLines.push('');
        profileRowLines.push(`<text x="30" y="${brightestStarsNeedWrap ? 248 : 270}" class="label">Hottest stars:</text>`);
        let valueY = brightestStarsNeedWrap ? 270 : 292;
        for (const line of brightestStarsLines) {
            profileRowLines.push(`<text x="45" y="${valueY}" class="value-indent">${line}</text>`);
            valueY += 22;
        }
        profileRowLines.push('');
        const totalY = brightestStarsNeedWrap ? Math.min(346, valueY + 4) : 330;
        profileRowLines.push(`<text x="30" y="${totalY}" class="label">Total stargazers: <tspan class="value">${totalLuminosity}</tspan></text>`);
    }
    const profileContent = `\n${profileRowLines.map(line => line ? `            ${line}` : '').join('\n')}`;

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">

            <style>
                body {
                    background: #050505;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    overflow: hidden;
                }

                .canvas-wrapper {
                    filter: drop-shadow(0 0 12px rgba(0, 242, 255, 0.5));
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: solid white 0.5px;
                }

                svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                @keyframes wobbleRotate {
                    0% {
                        transform: rotate(0deg) scale(1);
                    }

                    25% {
                        transform: rotate(90deg) scale(1.02) skewX(1deg);
                    }

                    50% {
                        transform: rotate(180deg) scale(1);
                    }

                    75% {
                        transform: rotate(270deg) scale(0.98) skewX(-1deg);
                    }

                    100% {
                        transform: rotate(360deg) scale(1);
                    }
                }

                .tui-border { stroke: ${tuiColor}; stroke-width: 1.5; fill: none; }
                .tui-header { fill: ${headerColor}; font-size: ${fontSize - 1}px; font-weight: bold; letter-spacing: 1px; font-family: ${fontFamily}; }
                .label { fill: ${labelColor}; font-size: ${fontSize}px; font-family: ${fontFamily}; }
                .value { fill: ${valueColor}; font-size: ${fontSize}px; font-family: ${fontFamily}; }
                .value-indent { fill: ${valueColor}; font-size: ${fontSize - 1}px; font-family: ${fontFamily}; }
            </style>

<defs>
                <filter id="neonGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
                
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id="secondLangGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feFlood flood-color="${secondLangColor}" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>

                <filter id="thirdLangGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feFlood flood-color="${thirdLangColor}" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>

                <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feFlood flood-color="${primaryLangColor}" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="softGlow" />
                    <feMerge>
                        <feMergeNode in="softGlow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>

                <clipPath id="viewportClip">
                    <rect x="${viewportX + 4}" y="${viewportY + 4}" width="${viewportWidth - 8}" height="${viewportHeight - 8}" rx="4" ry="4" />
                </clipPath>
            </defs>

            <rect width="${canvasWidth}" height="${canvasHeight}" fill="#050505"/>
            
            <g clip-path="url(#viewportClip)">
                <g id="starfield">${stars}</g>

                <g transform="translate(${translateX}, ${translateY})" filter="url(#neonGlow)" style="animation: float ${floatDur}s ease-in-out infinite;">
                    <g>
                ${connectionLines}
                        
                ${nodes}
                </g>
                </g>
            </g>

            ${showBorders ? `<path class="tui-border" d="M 15 20 H 25 M 80 20 H ${leftPanelRightX} V 150 H 15 V 20" />` : ''}
            <text x="30" y="24" class="tui-header">CHART</text>

            <text x="30" y="55" class="label">Constellation:</text>
            <text x="${chartValueX}" y="55" class="value" font-weight="bold">${displayName}</text>
${chartRows}

            ${showBorders ? `<path class="tui-border" d="M 15 170 H 25 M 95 170 H ${leftPanelRightX} V 350 H 15 V 170" />` : ''}
            <text x="30" y="174" class="tui-header">PROFILE</text>
${profileContent}

            ${showBorders ? `<path class="tui-border" d="M ${viewportX} 20 H ${viewportX + 10} M ${viewportX + 127} 20 H ${constellationPanelRightX} V 350 H ${viewportX} V 20" />` : ''}
            <text x="${viewportX + 15}" y="24" class="tui-header">CONSTELLATION</text>

            ${showBorders ? '<rect x="15" y="362" width="970" height="30" class="tui-border" />' : ''}
            <text x="30" y="382" class="label" font-weight="bold">&gt;</text>
            <rect x="44" y="370" width="2" height="${fontSize - 1}" fill="${valueColor}" opacity="0.8">
                <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
            </rect>
        </svg>`;

    return svg;
}

export { generateConstellation, normalizeHexColor }
