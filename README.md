# GitHub Profile Constellation

A dynamic SVG constellation of your GitHub profile, hosted on Vercel.

If you like space and want a change from Github Readme with stats with an evolving representation of your repository feel free to include this in your profile's readme !

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

## Ideas for future development

- Represent followers and poeple you are following
- Gist representation ?
