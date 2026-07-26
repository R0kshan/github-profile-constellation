# GitHub Profile Constellation

A dynamic SVG constellation of your GitHub profile, hosted on Vercel. It displays a space-like constellation that evolves automatically as you create more repositories, receive, and give stars.

I initially made this for myself but feel free to use it or even contribute if you're interested !

## Why I made this

There are many cool Github readme stats out there, but I wanted something different, something *representative* rather *evaluative*.

The idea : 
- Our knowledge is shaped by our work just like a constellation is shaped by its stars
- Distant ideas and knowledge enrich our work, just as distant stars illuminate the universe
- Blue being the hottest color, a *hot* repository (whether it's yours or one you've starred) will shine brighter and bluer as it gets starred

And what if one has just one repo ? It would be a "constellation" made of one star, but hey, all trees all came from seeds !

## Ideas for future development

Without cluterring :
- Represent followers and people you are following ?

## Preview

Preview on my profile available here : <https://github.com/R0kshan>

## Usage

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `username` | required | Your GitHub username |
| `terminalColor` | `#96C7FF` | Color of the terminal text |

### Example

```
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere"/>
```

If you want to customize the color of the terminal :

```
<img src="https://github-profile-constellation.vercel.app/?username=YourGithubUsernameHere&terminalColor=%234d4945"/>
```

**NB :** Replace '#' by '%23'

## How it works

- **Nodes** — one per repository. Size and blueness reflect stargazer count.
- **Background stars** — generated from your starred repos, colored by their popularity (blueness is affect by number of stars received)
- **Link between nodes **: the colors are a combination of the Github assigned color the your 3 most used languages

## How to run locally 

Install Vercel : 

```
npm install -g vercel
```

Then run :

```
vercel dev --debug
```