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

async function generateConstellation(userName: string, terminalColor: string, showStargazers: boolean = true, showBorders: boolean = true): Promise<string> {
    const canvasWidth = 1000;
    const canvasHeight = 400;

    const constellationCenterX = (canvasWidth / 2) + 40;
    const constellationCenterY = (canvasHeight / 2) - 10;

    const viewportX = 358;
    const viewportY = 20;
    const viewportWidth = 627;
    const viewportHeight = 330;
    const viewportCenterX = viewportX + viewportWidth / 2;
    const viewportCenterY = viewportY + viewportHeight / 2;

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

    const constellation = getConstellation(2, 0, 0);

    const xs = constellation.map(n => n.x);
    const ys = constellation.map(n => n.y);
    const bboxCenterX = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : viewportCenterX;
    const bboxCenterY = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : viewportCenterY;
    const translateX = viewportCenterX - bboxCenterX;
    const translateY = viewportCenterY - bboxCenterY;

    const connectionLines = (() => {
        const lines = [];
        const connected = [0];
        const unreachable = [...Array(constellation.length).keys()].slice(1);

        while (unreachable.length > 0) {
            const pairs = connected.flatMap(i =>
                unreachable.map((toIdx, j) => ({ i, j, d: Math.hypot(constellation[i].x - constellation[toIdx].x, constellation[i].y - constellation[toIdx].y) }))
            );
            const best = pairs.reduce((min, p) => p.d < min.d ? p : min);

            const toIdx = unreachable[best.j];

            if (best.d < canvasWidth * 0.35) {
                const x1 = constellation[best.i].x;
                const y1 = constellation[best.i].y;
                const x2 = constellation[toIdx].x;
                const y2 = constellation[toIdx].y;

                lines.push(`
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
        `);
            }

            connected.push(toIdx);
            unreachable.splice(best.j, 1);
        }
        return lines.join('\n');
    })();

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

    const brightestStar = repos.length > 0
        ? repos.reduce((max, r) => r.stargazers_count > max.stargazers_count ? r : max)
        : null;
    const brightestStarName = escapeXml(brightestStar?.name || '—');
    const brightestStarStars = brightestStar?.stargazers_count ?? 0;

    const totalLuminosity = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    const stellarComposition = escapeXml(topThreeLanguages.slice(0, 3).join(' • ') || '—');

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

                .tui-border { stroke: #318a80; stroke-width: 1.5; fill: none; }
                .tui-header { fill: #48c2b5; font-size: 13px; font-weight: bold; letter-spacing: 1px; font-family: Consolas; }
                .label { fill: #65d6c8; font-size: 14px; font-family: Consolas; }
                .value { fill: #c1fdf6; font-size: 14px; font-family: Consolas; }
                .value-indent { fill: #c1fdf6; font-size: 13px; font-family: Consolas; }
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

            ${showBorders ? '<path class="tui-border" d="M 15 20 H 25 M 80 20 H 344 V 150 H 15 V 20" />' : ''}
            <text x="30" y="24" class="tui-header">CHART</text>

            <text x="30" y="55" class="label">Constellation:</text>
            <text x="175" y="55" class="value" font-weight="bold">${displayName}</text>

            <text x="30" y="83" class="label">Coordinates:</text>
            <text x="175" y="83" class="value">${profileUrl}</text>

            <text x="30" y="111" class="label">Visible stars:</text>
            <text x="175" y="111" class="value">${visibleNodes}</text>

            ${showBorders ? '<path class="tui-border" d="M 15 170 H 25 M 95 170 H 344 V 346 H 15 V 170" />' : ''}
            <text x="30" y="174" class="tui-header">PROFILE</text>

            <text x="30" y="212" class="label">Main composition:</text>
            <text x="45" y="234" class="value-indent">${stellarComposition}</text>
            ${showStargazers ? `
            <text x="30" y="267" class="label">Brightest star:</text>
            <text x="45" y="289" class="value-indent">${brightestStarName} (${brightestStarStars})</text>

            <text x="30" y="322" class="label">Total stargazers: <tspan class="value">${totalLuminosity}</tspan></text>
            ` : ''}

            ${showBorders ? '<path class="tui-border" d="M 358 20 H 368 M 485 20 H 985 V 350 H 358 V 20" />' : ''}
            <text x="373" y="24" class="tui-header">CONSTELLATION</text>

            ${showBorders ? '<rect x="15" y="362" width="970" height="30" class="tui-border" />' : ''}
            <text x="30" y="382" class="label" font-weight="bold">&gt;</text>
            <rect x="44" y="370" width="2" height="13" fill="${terminalColor}" opacity="0.8">
                <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
            </rect>
        </svg>`;

    return svg;
}

export { generateConstellation }
