# GitHub Profile Constellation

A dynamic SVG constellation of your GitHub profile, hosted on Vercel. It displays a space-like constellation that evolves automatically as you create more repositories, receive, and give stars.

I initially made this for myself but feel free to use it or even contribute if you're interested !

## Why I made this

There are many cool Github readme stats out there, but I wanted something different, something *representative* rather *evaluative*.

The idea : 
- Our knowledge is shaped by our work just like a constellation is shaped by its stars
- Distant ideas and knowledge enrich our work, just as distant stars illuminate the universe
- Blue being the hottest color, a *hot* repository (whether it's yours or one you've starred) will shine brighter and bluer as it gets starred

And what if you only have one repo? A single star may look small on its own, but it’s the first spark of a future constellation.

## Ideas for future development

Without cluterring :
- Represent followers and people you are following ?

## Preview using my profile

<a href="https://github.com/R0kshan/github-profile-constellation">
  <img src="https://github-profile-constellation.vercel.app/?username=R0kshan"/>
</a>

## Usage

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `username` | required | Your GitHub username |
| `terminalColor` | `#96C7FF` | Color of the terminal cursor |
| `showStargazers` | `1` | Show brightest star and total stargazers section (`0` to hide) |
| `showBorders` | `1` | Show TUI panel borders (`0` to hide) |

### Examples

Basic usage:

```html
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere"/>
```

Custom terminal color (replace `#` with `%23`):

```html
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere&terminalColor=%234d4945"/>
```

Hide stargazer stats and TUI borders:

```html
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere&showStargazers=0&showBorders=0"/>
```

## How it works

- **Nodes** — one per repository. Size and blueness reflect stargazer count, connected by a minimal spanning tree.
- **Background stars** — generated from your starred repos, colored by their popularity (blueness is affected by number of stars received).
- **Links between nodes** — colored by your 3 most-used languages using GitHub-assigned language colors.
- **TUI layout** — a terminal-inspired interface with a CHART panel (constellation name, coordinates, visible stars), a PROFILE panel (brightest star, total stargazers, main composition), and a CONSTELLATION viewport.

## How to run locally 

Install Vercel : 

```
npm install -g vercel
```

Then run :

```
vercel dev --debug
```