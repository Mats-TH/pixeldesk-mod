# Changelog

All notable changes to PixelDesk are listed here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-10-31

### Added

- `/pixeldesk compact` compacts now, like Automatic mode does, once the turn is over.

### Fixed

- Automatic mode now compacts in the desktop app. It runs `/compact`, the only way the app allows.

## [1.1.0] - 2026-10-31

The cache stays warm, and the conversation changes by itself.

### Added

- A fireplace in the room that shows how warm the cache is: full, medium, low, embers, out.
- Automatic cache relaunches, on by default. 45 seconds before the cache cools, PixelDesk sends one line, `Reply with the single word: ok`, on top of the cached context. A keeper brings a log after each one.
- Each relaunch uses tokens and counts toward your limits. `/pixeldesk warm off` stops relaunches, and `~/.claude/pixeldesk/logs/pixeldesk.log` lists each one.
- Relaunch caps: an idle conversation stops at 30 relaunches or 2 hours, and a conversation at work has no cap. A plan step alone only counts as work for 15 minutes after the last activity.
- No relaunch while the cache length is unknown. Your normal turns prove it, for free.
- Ash in front of the fire that shows how full the conversation is, full at 80% of the context.
- A card on hover with the state of the cache, the time left, the relaunches and the exact percentage.
- Automatic conversation change: PixelDesk compacts, then changes, once the agents have finished. A slider sets 0, 1, 2, 3 or Always, with 2 by default.
- A new conversation in the session's exact folder, with its first message already sent. It needs the `claude` command. Without it, the text is ready and you press Enter.
- Manual mode, with a `Change` button on the fireplace. It is the switch that stops the automatic compaction and change.
- New settings in the panel on the wall: a Cache section, Automatic or Manual, and the slider.
- Handoffs and compaction notes in plain text in `~/.claude/pixeldesk/handoffs/`.
- `/pixeldesk warm`, `/pixeldesk warm on`, `/pixeldesk warm off` and `/pixeldesk refresh` commands, and a `refresh` tool for Claude.

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

[1.1.1]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.1.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
[1.0.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
