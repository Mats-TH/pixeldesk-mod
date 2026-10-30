[Lire en français](README.fr.md)

![PixelDesk](assets/banner.png)

**Your Claude Code agents, hard at work in a tiny pixel office.**

![The PixelDesk bar above the prompt](assets/bar.gif)

## What it does

Claude Code does a lot while you wait. PixelDesk lets you see it.

Your plan, your usage limits and every subagent stay on screen, live, right next to the chat.

## Features

- **Pixel bar.** An 80 px band above the prompt, with your plan, its progress, and your 5-hour and weekly limits.
- **One desk per subagent.** Every agent gets a desk in the room, live. Hover a desk to read its card.
- **Your Manager desk.** The conversation sits at its own desk, at the head of the room. It works during a turn and naps between two.
- **Tidy desks.** Finished desks leave on their own. Pick when with the settings button on the wall.
- **Floor plan.** A conversation that runs others sees them all at a glance, one room each.
- **Plan tool.** Claude announces its steps with a `plan` tool, and the bar follows along.
- **French and English.** The whole interface speaks both.

![The PixelDesk panel](assets/panel.png)

In the terminal, you get the same information as text: a bar drawn in characters and a list of agents.

## Install

**Terminal session**

```
/plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Answer `y` to add the marketplace, then choose a scope.

**Shell**

```
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

**Desktop app**

`/plugin` does not run there. Click **+** next to the prompt box, then **Plugins**. Choose **Add marketplace**, enter `Mats-TH/pixeldesk-mod`, then **Add plugin**.

## Usage

Nothing to set up. Once installed, PixelDesk runs on its own.

The bar is always there. The panel opens with the session in the desktop app, and with your first agent in the terminal.

| Command | What it does |
| --- | --- |
| `/pixeldesk` | Opens the panel, and stops hiding it if it was hidden. |
| `/pixeldesk hide` | Closes the panel in every conversation and stops it opening by itself. The bar stays, and tracking keeps running. |
| `/pixeldesk show` | Opens the panel here and lets it open by itself again. |
| `/pixeldesk departure` | Tells you when finished desks leave. |
| `/pixeldesk departure plan` | Finished desks stay until the plan ends, then leave together. This is the default. |
| `/pixeldesk departure each` | Each desk leaves 30 seconds after its agent finishes. |

To remove the bar too, turn the plugin off with `/plugin`.

In the desktop app, the settings button on the wall of the room does the same as `departure`. Your choice goes for every conversation.

## Language

PixelDesk picks its language by itself. It follows your Claude Code `language` setting, then your system language, and falls back to English.

To force one, use the `language` option: `auto` (the default), `fr` or `en`. Change it in the plugin's options, or set it when you install:

```
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod --config language=fr
```

## Good to know

- **Known limit.** A mod cannot remove the panel's inner margin or its scroll gutter.
- **Tested on** Claude Code 2.1.309, Windows. You need a recent Claude Code that loads hook modules.
- **Your files.** The mod writes in `~/.claude/pixeldesk/`. One exception: on Windows, when no language is set anywhere, it asks PowerShell once for your system language and keeps it in Claude Code's plugin storage.
- **Limits.** The gauges show `--` until Claude Code reports a reading.
- **Floor plan.** On Windows, it reads the links between conversations from the desktop app. Elsewhere, it groups the conversations of the same project.
- **Usage.** To keep the bar up to date, PixelDesk adds a short instruction to Claude's prompt and to each subagent's, plus a short reminder after some tool calls. While the panel is open, the plain-language desk summaries come from small Haiku calls.

## Credits

The pixel font is Jersey 10. See [CREDITS.md](CREDITS.md).

## License

MIT. See [LICENSE](LICENSE).

---

PixelDesk is a community project. It is not affiliated with or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.
