<p align="center"><a href="README.fr.md">Lire en français</a></p>

<p align="center">
  <img src="assets/banner.png" alt="PixelDesk Mod: a pixel art interface to follow your Claude agents">
</p>

<h3 align="center">A pixel art interface to follow your Claude agents live.</h3>

<p align="center">Agents, plan and limits on screen. A cache kept alive to spend fewer tokens.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-mod-FFC857?style=flat-square&labelColor=2A2036" alt="A mod for Claude Code">
  <img src="https://img.shields.io/badge/themes-6-E8643C?style=flat-square&labelColor=2A2036" alt="Six themes">
  <img src="https://img.shields.io/badge/license-MIT-7FB069?style=flat-square&labelColor=2A2036" alt="MIT license">
  <img src="https://img.shields.io/badge/lang-EN_%2F_FR-9DB4FF?style=flat-square&labelColor=2A2036" alt="English and French">
</p>

<p align="center">
  <a href="#how-to-install-pixeldesk-mod"><b>Install</b></a> &nbsp;·&nbsp;
  <a href="#what-pixeldesk-mod-shows-on-your-screen"><b>The interface</b></a> &nbsp;·&nbsp;
  <a href="#the-global-view-all-your-conversations-at-a-glance"><b>The global view</b></a> &nbsp;·&nbsp;
  <a href="#built-to-save-you-tokens"><b>Save tokens</b></a> &nbsp;·&nbsp;
  <a href="#6-themes-available-for-your-pixeldesk"><b>Themes</b></a> &nbsp;·&nbsp;
  <a href="#commands"><b>Commands</b></a>
</p>

<p align="center">
  <img src="assets/hero.png" alt="The six PixelDesk Mod themes in slanted columns: Cosy, Japanese, Nature, Futuristic, Geek and Base, each with its decor, its fire and a desk" width="880">
</p>

<p align="center"><sub>The six themes in one montage, made from the mod's real art.</sub></p>

PixelDesk Mod adds a pixel art interface to Claude Code, in the form of a small office.

Every agent has a desk, your plan is on the wall, and your limits stay visible. It all updates live, next to your conversation.

The interface is only the visible part. The mod also keeps your cache alive and changes conversation at the right moment, to reduce your token use.

Free and open source, under the MIT license.

## How to install PixelDesk Mod

**In the Claude desktop app, open the Code tab and paste this line into the conversation:**

```
Install the PixelDesk Mod plugin. Run: claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod (if claude is not found, use the path in the CLAUDE_CODE_EXECPATH environment variable instead).
```

Use the copy button, as the line runs past the edge of the box. Claude runs the install for you: allow it when asked.

Then open a new conversation in the Code tab. The mod is active.

| Where you are | What to do |
| --- | --- |
| **In the Code tab** | Paste the line above. No terminal needed. |
| **In a normal chat** | It can't install the mod. A chat doesn't run commands on your computer, and the mod lives in the Code tab. Switch to the Code tab, then paste the line. |
| **In a terminal** | Run the command given in the block below. |

<details>
<summary><b>Other ways to install</b></summary>

<br>

**From any terminal:**

```bash
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

**With the app's buttons:** click **+** next to the prompt box, then **Plugins**, then **Add marketplace**. Paste `Mats-TH/pixeldesk-mod`, then click **Add plugin**.

**From a terminal session that's already open:**

```
/plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Answer `y` to add the marketplace, then choose a scope.

**To force a language at install:**

```bash
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod --config language=fr
```

You need Git on your machine: the plugin is fetched from GitHub.

</details>

## What PixelDesk Mod shows on your screen

<p align="center">
  <img src="assets/demo.gif" alt="A conversation with the live bar above the prompt, and the room beside it. The same moment plays in all six themes: the keeper brings a log and the fire comes back." width="880">
</p>

<p align="center"><sub>A mock-up, drawn by the mod's own code. The bar, the room and the keeper are the real art.</sub></p>

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/feature-agents.png" alt="The Boss and two agents at their desks">
      <br><b>A desk for every agent</b>
      <br>Every subagent sits at its own desk, live. Hover it to read what it's doing. Your main conversation is the Boss.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-plan.png" alt="The plan on a board on the wall">
      <br><b>Your plan on the wall</b>
      <br>Claude announces its steps, and you follow along. Hover a step for its detail and who's on it.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-band.png" alt="The bar above the prompt, with the plan and the two limits">
      <br><b>Your limits, always visible</b>
      <br>A bar above the prompt shows your progress and your 5-hour and weekly limits.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/feature-cache.png" alt="The stove and the keeper bringing a log">
      <br><b>A fire that shows your cache</b>
      <br>The fire burns down as your cache gets close to expiring. A keeper brings a log to keep it alive.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-move.png" alt="The stove, the ash, and a plate saying the briefing is ready">
      <br><b>Ash that shows how full you are</b>
      <br>The pile grows with your conversation. When it's full, the mod takes over.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-settings.png" alt="The settings panel open in the room">
      <br><b>A settings panel</b>
      <br>The button on the wall opens the Settings: theme, relaunches, compaction.
    </td>
  </tr>
</table>

### Other features

- **A card on the fire.** Hover it for the time left and exactly how full you are.
- **Desks that tidy themselves.** Finished agents leave on their own.
- **Tokens and cost on display** on the wall of the room.
- **A crab** that lives in the room.
- **French and English.** The mod picks by itself.
- **A terminal version.** Simpler, in text, without the pixel art.

## The global view: all your conversations at a glance

<p align="center">
  <img src="assets/themes/cosy-floor.png" alt="The global view in the Cosy theme: the Boss and four sub-conversations, each in its own house with its name and state" width="880">
</p>

As soon as your main conversation starts others, PixelDesk Mod changes interface.

The room gives way to a global view, made for the Boss: all its sub-conversations in one image. It opens by itself.

- **One room per sub-conversation**, with its name and its Manager.
- **Its state, written below:** how many agents are working, or whether the Manager is.
- **A conversation at rest goes dark**, so the active ones stand out.
- **Its tokens** next to its name.
- **A list of all your conversations** on the Boss's wall, ticked as they finish.
- **A card on hover** to read where each one stands.

## Built to save you tokens

PixelDesk Mod works on two things: the cache, and the size of your conversation. First, the cache.

### What is the Claude cache?

With every message, Claude rereads your whole conversation. To limit that cost, it stores a copy in a cache.

While that cache is valid, rereading costs [a fraction of the normal price](https://platform.claude.com/docs/en/about-claude/pricing#prompt-caching). Once it expires, your next message has to reread everything at full price.

The longer the conversation, the bigger the gap.

### 5-minute or 1-hour cache: which one do you have?

The length depends on your account, not on where you work, according to [the Claude Code docs](https://code.claude.com/docs/en/prompt-caching):

| Your account | Main conversation | Subagents |
| --- | --- | --- |
| Claude subscription, within your included usage | 1 hour | 5 minutes |
| Claude subscription, on usage credits | 5 minutes | 5 minutes |
| API key, Bedrock or Vertex | 5 minutes | 5 minutes |

Every message restarts that timer, so the cache stays valid while you work.

It expires when you step away: a break, a meeting, lunch.

### How PixelDesk Mod keeps your cache alive

The mod watches the cache of your main conversation. It detects how long it lasts by itself, with nothing to set.

Just before it expires, the mod sends Claude one very short line. Claude reads from the cache, and the timer starts over. That's a relaunch.

When you come back, the cache is still valid, and your next message costs less.

<p align="center">
  <img src="assets/panel.png" alt="The card of the fireplace next to the room, with the keeper at the stove" width="880">
</p>

### What relaunches cost

A relaunch uses tokens too, and it counts toward your limits.

It pays off if you come back. If not, it was spent for nothing. That's why the mod stops by itself after a while on an idle conversation.

The saving depends on the size of your conversation and how you work. It hasn't been measured for the public, so there's no number here.

Relaunches can be turned off in the Settings.

## How PixelDesk Mod keeps you from losing context

Context is everything Claude has in mind in your conversation. Its size is limited.

When it fills up, Claude Code compacts: it replaces old messages with a summary. That frees up space, but details disappear each time. The more it compacts, the thinner the context gets.

So PixelDesk Mod changes conversation at the right moment, to preserve your context.

**By default, the mod compacts twice, then changes conversation:**

1. Your conversation reaches 80% of its context limit: the ash pile is full.
2. The mod compacts a first time, and you carry on.
3. It climbs back to 80%: the mod compacts a second time.
4. It climbs back to 80% again: the mod opens a new conversation, with a briefing already read.

If Claude Code compacts by itself along the way, that counts as one of the two.

**It also saves tokens.** A new conversation is short, so every message has less to reread.

**The useful context is kept.** Before each compaction, the mod notes the files, the decisions and your requests. The briefing starts from those notes, not from a summary of a summary.

**Work in progress isn't interrupted.** The mod waits for the end of the turn and for your agents to finish. The new conversation opens in the same folder.

You can change this behavior in the Settings.

## 6 themes available for your PixelDesk

Each theme has its own decor, desks, stove and global view.

To switch, open the Settings and pick one in the Theme column.

Each theme is shown in two images: the room, then the global view.

### Cosy

<p align="center">
  <img src="assets/themes/cosy-room.png" alt="The room, Cosy theme" width="400">
  <img src="assets/themes/cosy-floor.png" alt="The global view, Cosy theme" width="400">
</p>

### Japanese

<p align="center">
  <img src="assets/themes/japonais-room.png" alt="The room, Japanese theme" width="400">
  <img src="assets/themes/japonais-floor.png" alt="The global view, Japanese theme" width="400">
</p>

### Nature

<p align="center">
  <img src="assets/themes/nature-room.png" alt="The room, Nature theme" width="400">
  <img src="assets/themes/nature-floor.png" alt="The global view, Nature theme" width="400">
</p>

### Futuristic

<p align="center">
  <img src="assets/themes/futuriste-room.png" alt="The room, Futuristic theme" width="400">
  <img src="assets/themes/futuriste-floor.png" alt="The global view, Futuristic theme" width="400">
</p>

### Geek and games

<p align="center">
  <img src="assets/themes/geek-room.png" alt="The room, Geek and games theme" width="400">
  <img src="assets/themes/geek-floor.png" alt="The global view, Geek and games theme" width="400">
</p>

### Space base

<p align="center">
  <img src="assets/themes/base-room.png" alt="The room, Space base theme" width="400">
  <img src="assets/themes/base-floor.png" alt="The global view, Space base theme" width="400">
</p>

## Everything is in the Settings

The Settings open with the button on the wall of the room. Your choice applies to all your conversations.

| Setting | What you choose |
| --- | --- |
| **Theme** | One of the six themes. |
| **When desks leave** | Finished agents leave at the end of the plan, or one by one. |
| **Cache** | Relaunches on or off. |
| **Briefing** | Automatic or Manual. |
| **Automatic mode slider** | 0 to 3 compactions before changing conversation, or Always to compact and never change. |

In Manual mode, the mod stops compacting and changing conversation by itself. A button appears on the fireplace, and nothing moves until you click it.

## Good to know before you install

<details>
<summary><b>The limits on relaunches</b></summary>

<br>

A relaunch sends one line, `Answer only: ok`, on top of your cached context. A bigger conversation has more to read. Each relaunch is logged in `~/.claude/pixeldesk/logs/pixeldesk.log`, with the tokens it read and wrote.

- **Idle conversation.** 30 relaunches or 2 hours at most, then the fire goes out.
- **Conversation at work.** While a turn, an agent or a sub-conversation is running, there's no cap.
- **Plan step in progress.** It only counts as work for 15 minutes after the last activity.
- **Several conversations.** Each one counts on its own, and they add up.
- **Unknown cache length.** No relaunch until your messages have proved it.
- **Cache already expired.** The mod never relaunches it: that would cost the most and save nothing.
- **Failures.** Three in a row stop relaunches until your next message.

</details>

<details>
<summary><b>Changing conversation</b></summary>

<br>

- **Tokens too.** Writing a briefing, compacting and starting the new conversation all use your limits.
- **It needs the `claude` command.** Without it, or on Linux, the text waits in the new conversation and you press Enter.
- **Cache already expired.** The mod asks you before compacting or changing.
- **In plain text on your disk.** Briefings are written in `~/.claude/pixeldesk/briefings/`, with the compaction notes. The latest 20 are kept. Known secret formats are removed, but check a file before you share it.

</details>

<details>
<summary><b>The terminal version</b></summary>

<br>

In a terminal session, PixelDesk Mod shows up as text: a bar in characters and a list of agents. The pixel art stays in the desktop app.

Relaunches run there too, without the fireplace.

There's no wall to click. To go Manual, set `"briefingMode": "manual"` in `~/.claude/pixeldesk/settings.json`.

</details>

<details>
<summary><b>Compatibility, files and privacy</b></summary>

<br>

- **Tested** on Windows only so far, with Claude Code 2.1.309. Reports from macOS and Linux are very welcome.
- **Boss and Manager.** There's one Boss, your main conversation. The conversations it starts are Managers. The app's links are only read on Windows, so elsewhere a sub-conversation reads Boss too.
- **Language.** The mod follows your Claude Code `language` setting, then your system language, and falls back to English. To force one, use the plugin's `language` option: `auto`, `fr` or `en`.
- **Your files.** The mod writes in `~/.claude/pixeldesk/`. One exception: on Windows, when no language is set, it asks PowerShell once for your system language and keeps it in Claude Code's plugin storage.
- **Limits.** The gauges show `--` until Claude Code reports a reading.
- **Global view.** On Windows, it reads the links between conversations from the app. Elsewhere, it groups the conversations of the same project.
- **Usage.** To keep the bar up to date, the mod adds a short instruction to Claude's prompt and to each subagent's, plus a short reminder after some tool calls. While the panel is open, the desk summaries come from small Haiku calls.
- **Known limit.** A plugin cannot remove the panel's inner margin or its scroll gutter.

</details>

## Commands

| Command | What it does |
| --- | --- |
| `/pixeldesk` | Opens the panel. |
| `/pixeldesk theme <name>` | Changes the theme: `cosy`, `japonais`, `nature`, `futuriste`, `geek` or `base`. |
| `/pixeldesk fire off` | Turns relaunches off, in every conversation. `on` turns them back on. |
| `/pixeldesk fire` | Tells you where relaunches stand. |
| `/pixeldesk move` | Writes a briefing now, or once the running work is done. |
| `/pixeldesk compact` | Compacts now, once the turn is over. |

<details>
<summary><b>All the commands</b></summary>

<br>

| Command | What it does |
| --- | --- |
| `/pixeldesk` | Opens the panel, and stops hiding it if it was hidden. |
| `/pixeldesk hide` | Closes the panel everywhere and stops it opening by itself. The bar, the tracking and the relaunches keep running. |
| `/pixeldesk show` | Opens the panel here and lets it open by itself again. |
| `/pixeldesk theme` | Tells you the current theme and the names. |
| `/pixeldesk theme <name>` | Changes the theme, in every conversation. |
| `/pixeldesk departure` | Tells you when finished desks leave. |
| `/pixeldesk departure plan` | Finished desks stay until the plan ends, then leave together. This is the default. |
| `/pixeldesk departure each` | Each desk leaves 30 seconds after its agent finishes. |
| `/pixeldesk fire` | Tells you where the relaunches stand: on or off, time left, how many, and why they stopped. |
| `/pixeldesk fire on` | Turns relaunches on in every conversation. This is the default. |
| `/pixeldesk fire off` | Turns relaunches off in every conversation, and nothing else. The fire just follows the cache. |
| `/pixeldesk move` | Writes a briefing now, or as soon as the running work is done. Click `New conversation` when it is ready. |
| `/pixeldesk compact` | Compacts now, like Automatic mode does, once the turn is over. It counts toward the slider. |

To remove the bar too, turn the plugin off with `/plugin`.

</details>

## Credits and license

The pixel font is Jersey 10. See [CREDITS.md](CREDITS.md).

MIT. See [LICENSE](LICENSE). Free, no account, no telemetry.

---

<sub>PixelDesk Mod is a community project. It is not affiliated with or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.</sub>
