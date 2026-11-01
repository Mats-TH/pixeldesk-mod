# Changelog

All notable changes to PixelDesk Mod are listed here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.2] - 2026-11-01

Ready for the plugin directory, and clearer about what the mod does.

### Added

- The README now lists what the mod reads, writes, runs and sends, in English and French.
- The new conversation takes its title from the briefing, where the app shows it.

### Changed

- A new conversation now gets its briefing in its first message. The mod no longer asks it to read a file.
- The Read tool is no longer allowed automatically. That first answer has no tools and no connectors. Your tools come back when the conversation opens.
- Subagent prompts stay as they were written. Each agent gets its note on the plan with its first tool result.
- Every call the mod makes to Claude Code is now written out in one place, in `hooks/register.tsx`.

### Fixed

- The directory can now read how the mod calls Claude Code.
- The two demo animations are stored differently. Every pixel is the same.

## [1.3.1] - 2026-11-01

Every desk says whose it is.

### Changed

- The plugin has a new description: it says what the mod does, in plain words.
- The install section now explains what a normal chat can answer, and why the mod still goes through the Code tab.

### Fixed

- The global view writes the name on the desks in the Japanese and Futuristic themes: Boss or Patron, Manager, or the agent's role. Their plates were empty.

## [1.3.0] - 2026-11-01

Six rooms, and a panel that no longer freezes.

### Added

- Six room themes: Cosy, Japanese, Nature, Futuristic, Geek and games, Space base. Each one has its own furniture, stove and floor plan.
- `/pixeldesk theme <name>`, and a Theme column in the settings. Your choice goes for every conversation.
- The crab now has a life of its own in every theme, and naps on his bed.
- A plate over the token screen with the cost of the conversation, once Claude Code reports it.
- The settings button and panel on the floor plan too.

### Changed

- There is one boss now. The main conversation reads Boss in English and Patron in French, and a conversation started from another stays Manager. The links are only read on Windows: elsewhere, a sub-conversation reads Boss too.
- The boss stays at the desk in every theme, and sleeps there at rest.

### Fixed

- The panel no longer freezes on a theme change or with a long plan. The room now thins itself to stay under what the desktop app accepts.
- Buttons and hover zones now match their drawing to the pixel.
- The floor plan no longer replays the arrival of its camps at each redraw.
- The main camp's fire keeps burning on the Nature floor plan.

## [1.2.0] - 2026-10-31

### Changed

- PixelDesk now speaks its own language. `/pixeldesk move` starts a move to a new conversation, `/pixeldesk fire` drives the cache relaunches, and the document for the next conversation is a briefing.
- The settings are now `fire` and `briefingMode`. If you turned relaunches off or picked Manual, set them again.
- Briefings are now saved in `~/.claude/pixeldesk/briefings/`.

## [1.1.1] - 2026-10-31

### Added

- `/pixeldesk compact` compacts now, like Automatic mode does, once the turn is over.

### Fixed

- Automatic mode now compacts in the desktop app. It runs `/compact`, the only way the app allows.

## [1.1.0] - 2026-10-31

The cache stays hot, and the conversation changes by itself.

### Added

- A fireplace in the room that shows how hot the cache is: full, medium, low, embers, out.
- Automatic cache relaunches, on by default. 45 seconds before the cache cools, PixelDesk sends one line, `Answer only: ok`, on top of the cached context. A keeper brings a log after each one.
- Each relaunch uses tokens and counts toward your limits. `/pixeldesk fire off` stops relaunches, and `~/.claude/pixeldesk/logs/pixeldesk.log` lists each one.
- Relaunch caps: an idle conversation stops at 30 relaunches or 2 hours, and a conversation at work has no cap. A plan step alone only counts as work for 15 minutes after the last activity.
- No relaunch while the cache length is unknown. Your normal turns prove it, for free.
- Ash in front of the fire that shows how full the conversation is, full at 80% of the context.
- A card on hover with the state of the cache, the time left, the relaunches and the exact percentage.
- Automatic conversation change: PixelDesk compacts, then changes, once the agents have finished. A slider sets 0, 1, 2, 3 or Always, with 2 by default.
- A new conversation in the session's exact folder, with its first message already sent. It needs the `claude` command. Without it, the text is ready and you press Enter.
- Manual mode, with a `Change` button on the fireplace. It is the switch that stops the automatic compaction and change.
- New settings in the panel on the wall: a Cache section, Automatic or Manual, and the slider.
- Briefings and compaction notes in plain text in `~/.claude/pixeldesk/briefings/`.
- `/pixeldesk fire`, `/pixeldesk fire on`, `/pixeldesk fire off` and `/pixeldesk move` commands, and a `move` tool for Claude.

### Fixed

- The room no longer flickers every few seconds.

## [1.0.0] - 2026-10-30

First public release.

### Added

- Pixel bar of 80 px above the prompt, with the plan, its progress, and the 5-hour and weekly limits.
- Panel with a room and one live desk per subagent, and a card on hover.
- A Manager desk at the head of every room. It works during a turn of the conversation and rests between two.
- Finished desks leave the room by themselves, at the end of the plan or one by one.
- A settings button on the wall of the room, with the choice of when desks leave.
- Floor plan for a conversation that runs others.
- `plan` tool, so that Claude announces its steps. The bar also follows Claude Code's own task list tools.
- Text version of the bar and the panel for the terminal.
- `/pixeldesk`, `/pixeldesk hide`, `/pixeldesk show` and `/pixeldesk departure` commands.
- French and English, with automatic detection and a `language` option (`auto`, `fr`, `en`).

[1.3.1]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.3.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.2.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.1.1]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.1.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.0.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
