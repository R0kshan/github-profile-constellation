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

### How it works

- **Constellation stars** - one per repository. Size and blueness reflect stargazer count, connected by a minimal spanning tree.
- **Background stars** - generated from your starred repos, colored by their popularity (blueness is affected by number of stars received).
- **Links between nodes** - colored by your 3 most-used languages using GitHub-assigned language colors.

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
| `tuiColor` | `318a80` | Color of the TUI panel borders and text (hex, without the `#` prefix) |
| `showStargazers` | `1` | Show brightest stars and total stargazers section (`0` to hide) |
| `showBorders` | `1` | Show TUI panel borders (`0` to hide) |

### Examples

Basic usage:

```html
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere"/>
```

Custom TUI border color (also tints the panel text and cursor):

```html
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere&tuiColor=ff0000"/>
```

Hide stargazer stats and TUI borders:

```html
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere&showStargazers=0&showBorders=0"/>
```

## How to run locally 

Install Vercel : 

```
npm install -g vercel
```

Then run :

```
vercel dev --debug
```