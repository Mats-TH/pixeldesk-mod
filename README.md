[Lire en français](README.fr.md)

![PixelDesk](assets/banner.png)

**Your Claude Code agents, hard at work in a tiny pixel office.**

Made for the Claude desktop app. That is where you get the pixel bar, the live room and the floor plan.

![PixelDesk at work: the room, the keeper feeding the fire, and the bar above the prompt](assets/bar.gif)

## Install in the desktop app

Paste this into any terminal:

```
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Then open a new conversation in the **Code** tab of the Claude desktop app. That's it.

No `claude` command on your machine? Do it from the app. Click **+** next to the prompt box, then **Plugins**, then **Add marketplace**. Paste this, then click **Add plugin**:

```
Mats-TH/pixeldesk-mod
```

## What it does

Claude Code does a lot while you wait. PixelDesk lets you see it.

Your plan, your usage limits and every subagent stay on screen, live, right next to the chat.

It also keeps your cache warm, and moves you to a fresh conversation before the old one fills up.

Heads up: cache relaunches are automatic and on by default. They use tokens. `/pixeldesk warm off` stops them.

## Features

- **Pixel bar.** An 80 px band above the prompt, with your plan, its progress, and your 5-hour and weekly limits.
- **One desk per subagent.** Every agent gets a desk in the room, live. Hover a desk to read its card.
- **Your Manager desk.** The conversation sits at its own desk, at the head of the room. It works during a turn and naps between two.
- **Tidy desks.** Finished desks leave on their own. Pick when with the settings button on the wall.
- **Floor plan.** A conversation that runs others sees them all at a glance, one room each.
- **Plan tool.** Claude announces its steps with a `plan` tool, and the bar follows along.
- **A fireplace for your cache.** The fire shows how warm your cache is. A keeper walks in with a log to keep it going.
- **Ash that fills up.** The pile in front of the fire shows how full the conversation is.
- **Automatic conversation change.** PixelDesk compacts, then moves on by itself, with your handoff already read.
- **French and English.** The whole interface speaks both.

![The PixelDesk room with the keeper at the fireplace, next to the card of the fireplace](assets/panel.png)

## The fireplace

### Your cache stays warm

Claude keeps your conversation in a cache, for 5 minutes or 1 hour. Once it goes cold, your next message pays to read everything again.

PixelDesk watches that clock. 45 seconds before the cache cools, it sends a relaunch, and the clock starts over.

A relaunch is one fixed line, `Reply with the single word: ok`, on top of the cached context. Nothing else.

The fire burns down with the time left: full, medium, low, embers, out. After each relaunch, the keeper brings in a log and the fire is back to full.

PixelDesk never relaunches a cache its clock says is cold. That would cost the most and save nothing. If a relaunch still finds it cold, the relaunches stop until your next turn.

This is on by default, and it uses tokens. Read [Good to know](#good-to-know) for the limits and the off switch.

### The ash shows how full you are

Ash piles up in front of the fire as the conversation fills. The pile is full at 80% of the context. That is the moment to change.

Hover the fireplace to open its card: what the cache is, the time left, the relaunches, its state, the exact percentage and the compactions.

### A fresh conversation, by itself

When the ash is full, PixelDesk waits for the end of the turn. Then it compacts, or it changes conversation.

In Automatic mode, a slider decides. You will find it in the settings panel, behind the button on the wall:

- **0.** It changes conversation straight away.
- **1, 2 or 3.** It compacts that many times, then changes. The default is 2.
- **Always.** It only compacts, and never changes.

Compactions run by Claude Code itself count too. Before each compaction, PixelDesk saves the files, decisions and requests it finds, so the final handoff never sums up a summary.

**It waits for your agents.** Agents and floor conversations finish first, so their results land in the handoff. In a hurry? `Change now` stays available.

**It opens in the same folder.** The new conversation starts in the session's exact folder, worktree included, with its first message already sent.

**It needs the `claude` command.** Without it, or on Linux, the text is ready in the new conversation and you press Enter.

Prefer to decide? Switch to **Manual** in the settings panel. PixelDesk stops compacting and changing on its own. A `Change` button appears on the fireplace once the ash is full, and nothing moves until you click it. Once the handoff is ready, click `New conversation`.

## In the terminal

PixelDesk also runs in a terminal session, as a simpler text version: a bar drawn in characters and a list of agents. The pixel art stays in the desktop app.

Cache relaunches run there too, without the fireplace. `/pixeldesk warm off` works the same.

There is no wall to click in the terminal. To go Manual, set `"handoffMode": "manual"` in `~/.claude/pixeldesk/settings.json`.

To install it from a running terminal session:

```
/plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Answer `y` to add the marketplace, then choose a scope.

## Usage

Nothing to set up. Once installed, PixelDesk runs on its own.

The bar is always there. The panel opens with the session in the desktop app, and with your first agent in the terminal.

| Command | What it does |
| --- | --- |
| `/pixeldesk` | Opens the panel, and stops hiding it if it was hidden. |
| `/pixeldesk hide` | Closes the panel in every conversation and stops it opening by itself. The bar stays. Tracking, relaunches and the automatic change keep running. |
| `/pixeldesk show` | Opens the panel here and lets it open by itself again. |
| `/pixeldesk departure` | Tells you when finished desks leave. |
| `/pixeldesk departure plan` | Finished desks stay until the plan ends, then leave together. This is the default. |
| `/pixeldesk departure each` | Each desk leaves 30 seconds after its agent finishes. |
| `/pixeldesk warm` | Tells you where the relaunches stand: on or off, time left, how many, and why they stopped. |
| `/pixeldesk warm on` | Turns relaunches on in every conversation. This is the default. |
| `/pixeldesk warm off` | Turns relaunches off in every conversation, and nothing else. The fire just follows the cache. |
| `/pixeldesk refresh` | Writes a handoff now, or as soon as the running work is done. Click `New conversation` when it is ready. |
| `/pixeldesk compact` | Compacts now, like Automatic mode does, once the turn is over. It counts toward the slider. |

To remove the bar too, turn the plugin off with `/plugin`.

In the desktop app, the button on the wall of the room opens the settings panel. Everything lives there:

- **Desks.** When finished desks leave.
- **Cache.** The relaunch switch.
- **Handoff.** Automatic or Manual, and the slider in Automatic mode.

Your choice goes for every conversation.

## Language

PixelDesk picks its language by itself. It follows your Claude Code `language` setting, then your system language, and falls back to English.

To force one, use the `language` option: `auto` (the default), `fr` or `en`. Change it in the plugin's options, or set it when you install:

```
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod --config language=fr
```

## Good to know

### Automatic relaunches are on by default

**Each relaunch sends one line, `Reply with the single word: ok`, on top of your cached context. It uses tokens, and it counts toward your limits.**

A bigger conversation has more to read. Every relaunch is written to `~/.claude/pixeldesk/logs/pixeldesk.log`, with the tokens it read and wrote.

- **Idle conversation.** 30 relaunches or 2 hours at most once the conversation goes quiet, then the fire goes out.
- **Conversation at work.** While a turn, an agent or a floor conversation is running, it stays warm with no cap.
- **Plan steps.** A step in progress only counts as work for 15 minutes after the last activity. After that, the idle caps apply.
- **Several conversations.** Each one counts on its own. There is no shared cap, so they add up.
- **Unknown cache length.** No relaunch at all. Your normal turns prove the length, for free. A very big conversation can wait a while for that proof.

**To stop relaunches, type `/pixeldesk warm off`.** It applies to every conversation, and it only stops relaunches.

**To stop the automatic compaction and change, pick Manual.** That switch is separate, and it lives in the settings panel.

`/pixeldesk hide` only closes the panel: relaunches keep running. Three failures in a row stop them until your next turn.

### Handoffs

- **In plain text.** Handoffs are written in the clear in `~/.claude/pixeldesk/handoffs/`, one file each, with the compaction notes. The latest 20 of each are kept. Known secret formats are removed, but check a file before you share it.
- **Tokens too.** Writing a handoff, compacting and starting the new conversation all use your limits.
- **Cold cache.** If the cache has already gone cold when the ash fills up, PixelDesk asks you first, with the `Change` button.

### The rest

- **Known limit.** A plugin cannot remove the panel's inner margin or its scroll gutter.
- **Tested on** Claude Code 2.1.309, Windows. You need a recent Claude Code that loads hook modules.
- **Your files.** PixelDesk writes in `~/.claude/pixeldesk/`. One exception: on Windows, when no language is set anywhere, it asks PowerShell once for your system language and keeps it in Claude Code's plugin storage.
- **Limits.** The gauges show `--` until Claude Code reports a reading.
- **Floor plan.** On Windows, it reads the links between conversations from the desktop app. Elsewhere, it groups the conversations of the same project.
- **Usage.** To keep the bar up to date, PixelDesk adds a short instruction to Claude's prompt and to each subagent's, plus a short reminder after some tool calls. While the panel is open, the plain-language desk summaries come from small Haiku calls.

## Credits

The pixel font is Jersey 10. See [CREDITS.md](CREDITS.md).

## License

MIT. See [LICENSE](LICENSE).

---

PixelDesk is a community project. It is not affiliated with or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.
