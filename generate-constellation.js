const config = window.GITHUB_CONFIG;
let statusLines = [];

function genRgbColorFromStargazerCount(count) {
    const progressiveBlueness = Math.log10(count + 1);
    const intensity = Math.min(progressiveBlueness / 3, 1);
    const rVal = Math.floor(255 - (255 * intensity));
    const gVal = Math.floor(255 - (13 * intensity));
    const bVal = 255;
    return `rgb(${rVal}, ${gVal}, ${bVal})`;
}

async function generateConstellation() {

    const status = document.getElementById('status');
    const container = document.getElementById('container');



    const headers = new Headers();

    if (config.token) headers.append("Authorization", `token ${config.token}`);

    try {

        // Canvas configuration
        const canvasCenterX = config.canvasWidth / 2;
        const canvasCenterY = (config.canvasHeight / 2) - 10;


        // Fetch repository data
        const [userRes, reposRes, eventsRes, gistsRes, starredRes, linguistRes] = await Promise.all([
            fetch(`https://api.github.com/users/${config.username}`, { headers }),
            fetch(`https://api.github.com/users/${config.username}/repos?per_page=100&sort=updated`, { headers }),
            fetch(`https://api.github.com/users/${config.username}/events/public`),
            fetch(`https://api.github.com/users/${config.username}/gists`),
            fetch(`https://api.github.com/users/${config.username}/starred?per_page=500`),
            fetch('https://raw.githubusercontent.com/github-linguist/linguist/master/lib/linguist/languages.yml')
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


        const randNumGen = new Math.seedrandom(config.username + yearsActive);

        const getConstellation = (scale, xOff, yOff) => {

            const constellation = (repos && repos.length ? repos : Array(constellationNodesCount).fill({}));

            return constellation.map((repo, currentRepoIndex) => {

                const constellationRandNumGen = new Math.seedrandom(`${repo.id}-${repo.size}`);
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
        const constellationPoints = constellation.map(point => `${point.x},${point.y}`).join(' ');

        // Generated stars in the background based on starred repos, with dynamic colors and sizes based on stargazer count
        const stars = starred.map(star => {
            const count = star.stargazers_count || 0;
            const intensity = Math.min(Math.log10(count + 1) / 3, 1);
            const dynamicColor = genRgbColorFromStargazerCount(star.stargazers_count || 0);

            const x = randNumGen() * config.canvasWidth;
            const y = randNumGen() * config.canvasHeight;
            const radius = 0.5 + (intensity * 2.5);
            const r = 0.5 + randNumGen() * 1.5;
            const d = 2 + randNumGen() * 4;
            return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${dynamicColor}" opacity="0.8">
                <animate attributeName="opacity" values="0.1;0.7;0.1" dur="${d}s" repeatCount="indefinite" />
            </circle>`;
        }).join('');

        const terminalOutput = [
            `> constellation scan -name ${config.displayName}`,
            `Running scan ...`,
            `Main composition: ${topThreeLanguages}`,
            `Observed by : https://github.com/R0kshan/github-profile-constellation`,
            `> <tspan class="cursor">|<animate attributeName="opacity" values="1;0;1" dur="1.5s" fill="${config.terminalColor}" repeatCount="indefinite" /></tspan>`
        ];

        container.innerHTML = `
    <svg width="${config.canvasWidth}" height="${config.canvasHeight}" viewBox="0 0 ${config.canvasWidth} ${config.canvasHeight}">
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
        
        <g id="starfield">${stars}</g>

        <g filter="url(#neonGlow)" style="animation: float ${floatDur}s ease-in-out infinite;">
            <g >
                <polyline points="${constellationPoints}" 
                fill="none" 
                stroke="${thirdLangColor}" 
                stroke-width="20" 
                stroke-opacity="0.07" 
                filter="url(#softGlow)" />

                <polyline points="${constellationPoints}" 
                fill="none" 
                stroke="${secondLangColor}" 
                stroke-width="5" 
                stroke-opacity="0.07" 
                filter="url(#softGlow)" />

                <polyline points="${constellationPoints}"  fill-opacity="0.00" stroke="${primaryLangColor}" stroke-width="1"/>
                
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
        <text class ="status" x="10" y="${config.canvasHeight - 70}" font-family="Consolas" font-size="10px" text-anchor="start" fill="${config.terminalColor}" style="filter: url(#neonTextGlow);">
            ${terminalOutput.map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : '1.4em'}">${line}</tspan>`).join('')}
        </text>
        <text class ="status" x="10" y="${config.canvasHeight - 70}" font-family="Consolas" font-size="10px" text-anchor="start" fill="${config.terminalColor}" >
            ${terminalOutput.map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : '1.4em'}">${line}</tspan>`).join('')}
        </text>
    </svg>`;

    } catch (e) {
        status.innerText = "SCANNING ERROR";
        console.error(e);
    }
}

function saveSvg() {
    const container = document.getElementById('container');
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    const status = document.getElementById('status');
    const statusText = statusLines;
    const svgClone = svgElement.cloneNode(true);

    svgClone.setAttribute("width", "100%");
    svgClone.setAttribute("height", "auto");
    svgClone.setAttribute("viewBox", `0 0 ${config.canvasWidth} ${config.canvasHeight}`);

    const headStyle = document.querySelector('style');
    const styleTag = document.createElement('style');

    styleTag.innerHTML = `
        ${headStyle ? headStyle.innerHTML : ''}
        svg { background-color: #050505; }
        g[style*="wobbleRotate"] { transform-origin: 500px 500px !important; }
    `;
    svgClone.prepend(styleTag);

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "1000");
    bgRect.setAttribute("height", "400");
    bgRect.setAttribute("fill", "#050505");
    svgClone.prepend(bgRect);

    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    svgClone.appendChild(textElement);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `github-constellation-${config.username}.svg`;
    link.click();
    URL.revokeObjectURL(url);
}