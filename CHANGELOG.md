# Changelog

All notable changes to PixelDesk are listed here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/Mats-TH/pixeldesk-mod/releases
