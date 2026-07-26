import jsyaml from 'js-yaml'
import seedrandom from 'seedrandom'

import { GitHubUser } from './types/GitHubUser'
import { GitHubRepo } from './types/GitHubRepo'
import { LinguistEntry } from './types/LinguistEntry'
import { ConstellationNode } from './types/ConstellationNode'

function genRgbColorFromStargazerCount(count: number): string {
    const progressiveBlueness = Math.log10(count + 1);
    const intensity = Math.min(progressiveBlueness / 3, 1);
    const rVal = Math.floor(255 - (255 * intensity));
    const gVal = Math.floor(255 - (13 * intensity));
    const bVal = 255;
    return `rgb(${rVal}, ${gVal}, ${bVal})`;
}

async function generateConstellation(userName: string, terminalColor: string): Promise<string> {
    // Canvas configuration
    let canvasWidth = 1000;
    let canvasHeight = 400;
    const canvasCenterX = (canvasWidth / 2) + 40;
    const canvasCenterY = (canvasHeight / 2) - 10;

    // Fetch repository data
    const fetchInit: RequestInit | undefined = process.env.GITHUB_TOKEN
        ? { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
        : undefined

    const [userRes, reposRes, , , starredRes, linguistRes] = await Promise.all([
        fetch(`https://api.github.com/users/${userName}`, fetchInit),
        fetch(`https://api.github.com/users/${userName}/repos?per_page=100&sort=updated`, fetchInit),
        fetch(`https://api.github.com/users/${userName}/events/public`, fetchInit),
        fetch(`https://api.github.com/users/${userName}/gists`, fetchInit),
        fetch(`https://api.github.com/users/${userName}/starred?per_page=500`, fetchInit),
        fetch(`https://raw.githubusercontent.com/github-linguist/linguist/master/lib/linguist/languages.yml`, fetchInit)
    ]);

    const userInfo: GitHubUser = await userRes.json();
    const repos: GitHubRepo[] = await reposRes.json();
    const starred: GitHubRepo[] = await starredRes.json();
    const linguist = jsyaml.load(await linguistRes.text()) as Record<string, LinguistEntry>;

    // Calculate top three most used languages
    const currentMostUsedLangInTheWorld = "Python";

    const languageCountKeyValueMap: Record<string, number> = {};
    repos.forEach(repo => {
        if (repo.language)
            languageCountKeyValueMap[repo.language] = (languageCountKeyValueMap[repo.language] || 0) + 1;
    });

    const topThreeLanguages = Object.entries(languageCountKeyValueMap)
        .sort((currentEntry, nextEntry) => nextEntry[1] - currentEntry[1])
        .slice(0, 3)
        .map(entry => entry[0]);

    const languageColors: Record<string, string> = {};
    for (const lang in linguist) {
        if (linguist[lang].color) {
            languageColors[lang] = linguist[lang].color;
        }
    }

    const primaryLangColor = languageColors[topThreeLanguages[0]] || languageColors[currentMostUsedLangInTheWorld] || "#ffffff";
    const secondLangColor = languageColors[topThreeLanguages[1]] || languageColors[currentMostUsedLangInTheWorld] || "#ffffff";
    const thirdLangColor = languageColors[topThreeLanguages[2]] || languageColors[currentMostUsedLangInTheWorld] || "#ffffff";

    const followers = userInfo.followers || 0;
    const floatDur = Math.max(3, 12 - Math.log10(followers + 1) * 3);

    const constellationNodesCount = repos.length;
    const yearsActive = (Date.now() - new Date(userInfo.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365.25);


    const randNumGen = seedrandom(userName + yearsActive);

    const getConstellation = (scale: number, xOff: number, yOff: number): ConstellationNode[] => {

        const constellation = (repos && repos.length ? repos : Array(constellationNodesCount).fill({})) as GitHubRepo[];

        return constellation.map((repo: GitHubRepo, currentRepoIndex: number) => {

            const constellationRandNumGen = seedrandom(`${repo.size}-${repo.id}-${repo.created_at}-${repo.node_id}`);
            const deterministicHash = constellationRandNumGen();

            const radius = (40 + (Math.pow(deterministicHash, 1.4) * 110)) * scale;
            const angle = (currentRepoIndex * Math.PI * 2) / constellation.length - Math.PI / 2;
            const rawX = canvasCenterX + xOff + radius * Math.cos(angle);
            const rawY = canvasCenterY + yOff + (radius * Math.sin(angle) * 0.6);

            const prevAngle = ((currentRepoIndex - 1) * Math.PI * 2) / constellation.length - Math.PI / 2;
            const prevRadius = (40 + (Math.pow(seedrandom(`${constellation[Math.max(0, currentRepoIndex-1)].size}-${constellation[Math.max(0, currentRepoIndex-1)].id}-${constellation[Math.max(0, currentRepoIndex-1)].created_at}-${constellation[Math.max(0, currentRepoIndex-1)].node_id}`)(), 1.4) * 110)) * scale;
            const prevX = canvasCenterX + xOff + prevRadius * Math.cos(prevAngle);
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

    const connectionLines = (() => {
        const lines = [];
        const connected = [0];
        const unreachable = [...Array(constellation.length).keys()].slice(1);

        while (unreachable.length > 0) {
            let minDist = Infinity;
            let bestFrom = -1;
            let bestToIndex = -1;

            for (const i of connected) {
                for (let j = 0; j < unreachable.length; j++) {
                    const toIdx = unreachable[j];
                    const d = Math.hypot(constellation[i].x - constellation[toIdx].x, constellation[i].y - constellation[toIdx].y);
                    if (d < minDist) {
                        minDist = d;
                        bestFrom = i;
                        bestToIndex = j;
                    }
                }
            }

            const toIdx = unreachable[bestToIndex];

            if (minDist < canvasWidth * 0.35) {
                const x1 = constellation[bestFrom].x;
                const y1 = constellation[bestFrom].y;
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
            unreachable.splice(bestToIndex, 1);
        }
        return lines.join('');
    })();

    // Generated stars in the background based on starred repos, with dynamic colors and sizes based on stargazer count
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

    const terminalOutput = [
        `> constellation scan -name ${userInfo.name || userName}`,
        `Running scan ...`,
        `Main composition: ${topThreeLanguages}`,
        `Observed by : https://github.com/R0kshan/github-profile-constellation`,
        `> <tspan class="cursor">|<animate attributeName="opacity" values="1;0;1" dur="1.5s" fill="${terminalColor}" repeatCount="indefinite" /></tspan>`
    ];

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg"  width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">

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

                .status {
                    position: absolute;
                    bottom: 20px;
                    font-size: 10px;
                    opacity: 0.4;
                    font-family: monospace;
                }

                a {
                    text-decoration: underline;
                }

                @keyframes blink-cursor {

                    0%,
                    49% {
                        fill-opacity: 1;
                    }

                    50%,
                    100% {
                        fill-opacity: 0;
                    }
                }

                .cursor {
                    animation: blink-cursor 1.5s infinite;
                }
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

                <filter id="neonTextGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>

            </defs>

            <rect width="${canvasWidth}" height="${canvasHeight}" fill="#050505"/>
            
            <g id="starfield">${stars}</g>

            <g filter="url(#neonGlow)" style="animation: float ${floatDur}s ease-in-out infinite;">
                <g>
            ${connectionLines}
                    
            ${constellation.map((node) => {
        const animationRadius = 1.5;

        const twinkleDuration = 1.5 + randNumGen() + node.stargazerIntensity;
        return `<circle cx="${node.x}" cy="${node.y}" r="${node.stargazerIntensity}" fill="${node.colorFromRepoStargazer}">
                <animate attributeName="r" values="${animationRadius};${node.stargazerIntensity};${animationRadius}" dur="${twinkleDuration}s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="${animationRadius};${animationRadius};${animationRadius}" dur="${twinkleDuration}s" repeatCount="indefinite" />
                </circle>
                `;
    }).join('')}
            </g>
        </g>
        <text class ="status" x="10" y="${canvasHeight - 70}" font-family="monospace" font-size="10px" text-anchor="start" fill="${terminalColor}" style="filter: url(#neonTextGlow);">
            ${terminalOutput.map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : '1.4em'}">${line}</tspan>`).join('')}
        </text>
        <text class ="status" x="10" y="${canvasHeight - 70}" font-family="monospace" font-size="10px" text-anchor="start" fill="${terminalColor}" >
            ${terminalOutput.map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : '1.4em'}">${line}</tspan>`).join('')}
        </text>

    </svg>`;

    return svg;
}

export { generateConstellation }

