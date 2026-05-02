const jsyaml = require('js-yaml')
const seedrandom = require('seedrandom')

function genRgbColorFromStargazerCount(count) {
    const progressiveBlueness = Math.log10(count + 1);
    const intensity = Math.min(progressiveBlueness / 3, 1);
    const rVal = Math.floor(255 - (255 * intensity));
    const gVal = Math.floor(255 - (13 * intensity));
    const bVal = 255;
    return `rgb(${rVal}, ${gVal}, ${bVal})`;
}

/*
    <script src="https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/seedrandom/3.0.5/seedrandom.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"></script>
*/


async function generateConstellation(userName, terminalColor) {

    // Canvas configuration
    let statusLines = [];
    let canvasWidth = 1000;
    let canvasHeight = 400;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = (canvasHeight / 2) - 10;

    // Fetch repository data
    const headers = process.env.GITHUB_TOKEN ? {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
    } : {}

    const [userRes, reposRes, eventsRes, gistsRes, starredRes, linguistRes] = await Promise.all([
        fetch(`https://api.github.com/users/${userName}`, { headers }),
        fetch(`https://api.github.com/users/${userName}/repos?per_page=100&sort=updated`, { headers }),
        fetch(`https://api.github.com/users/${userName}/events/public`, { headers }),
        fetch(`https://api.github.com/users/${userName}/gists`, { headers }),
        fetch(`https://api.github.com/users/${userName}/starred?per_page=500`, { headers }),
        fetch(`https://raw.githubusercontent.com/github-linguist/linguist/master/lib/linguist/languages.yml`, { headers })
    ]);

    const userInfo = await userRes.json();
    const repos = await reposRes.json();
    const events = await eventsRes.json();
    const gists = await gistsRes.json();
    const starred = await starredRes.json();
    const linguist = jsyaml.load(await linguistRes.text());

    // Calculate top three most used languages
    const currentMostUsedLangInTheWorld = "Python";

    const languageCountKeyValueMap = {};
    repos.forEach(repo => {
        if (repo.language)
            languageCountKeyValueMap[repo.language] = (languageCountKeyValueMap[repo.language] || 0) + 1;
    });

    const mostUsedLanguageByUser = Object.keys(languageCountKeyValueMap)
        .reduce(
            (currentKey, nextKey) => languageCountKeyValueMap[currentKey] > languageCountKeyValueMap[nextKey] ? currentKey : nextKey, currentMostUsedLangInTheWorld);

    const topThreeLanguages = Object.entries(languageCountKeyValueMap)
        .sort((currentEntry, nextEntry) => nextEntry[1] - currentEntry[1])
        .slice(0, 3)
        .map(entry => entry[0]);

    const languageColors = {};
    for (const lang in linguist) {
        if (linguist[lang].color) {
            languageColors[lang] = linguist[lang].color;
        }
    }

    const primaryLangColor = languageColors[topThreeLanguages[0]] || languageColors[currentMostUsedLangInTheWorld];
    const secondLangColor = languageColors[topThreeLanguages[1]] || languageColors[currentMostUsedLangInTheWorld];
    const thirdLangColor = languageColors[topThreeLanguages[2]] || languageColors[currentMostUsedLangInTheWorld];

    const followers = userInfo.followers || 0;
    const floatDur = Math.max(3, 12 - Math.log10(followers + 1) * 3);
    const prCount = events.filter(e => e.type === 'PushEvent').length;

    const constellationNodesCount = repos.length;
    const yearsActive = (new Date() - new Date(userInfo.created_at)) / (1000 * 60 * 60 * 24 * 365.25);


    const randNumGen = new seedrandom(userName + yearsActive);

    const getConstellation = (scale, xOff, yOff) => {

        const constellation = (repos && repos.length ? repos : Array(constellationNodesCount).fill({}));

        return constellation.map((repo, currentRepoIndex) => {

            const constellationRandNumGen = new seedrandom(`${repo.size}-${repo.id}-${repo.created_at}-${repo.node_id}`);
            const deterministicHash = constellationRandNumGen();

            const radius = (40 + (Math.pow(deterministicHash, 1.4) * 110)) * scale;
            const angle = (currentRepoIndex * Math.PI * 2) / constellation.length - Math.PI / 2;
            const x = canvasCenterX + xOff + radius * Math.cos(angle);
            const y = canvasCenterY + yOff + (radius * Math.sin(angle) * 0.6);

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
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                  stroke="${thirdLangColor}" stroke-width="20" stroke-opacity="0.07" filter="url(#softGlow)" />

            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                  stroke="${secondLangColor}" stroke-width="5" stroke-opacity="0.07" filter="url(#softGlow)" />

            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                  stroke="${primaryLangColor}" stroke-width="1" stroke-opacity="0.8" />
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
        const r = 0.5 + randNumGen() * 1.5;
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
                    font-family: Consolas;
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
                    
            ${constellation.map((node, i) => {
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
        <text class ="status" x="10" y="${canvasHeight - 70}" font-family="Consolas" font-size="10px" text-anchor="start" fill="${terminalColor}" style="filter: url(#neonTextGlow);">
            ${terminalOutput.map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : '1.4em'}">${line}</tspan>`).join('')}
        </text>
        <text class ="status" x="10" y="${canvasHeight - 70}" font-family="Consolas" font-size="10px" text-anchor="start" fill="${terminalColor}" >
            ${terminalOutput.map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : '1.4em'}">${line}</tspan>`).join('')}
        </text>

    </svg>`;

    return svg;
}

module.exports = { generateConstellation }

