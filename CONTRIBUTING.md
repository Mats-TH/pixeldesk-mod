# Contributing to PixelDesk

Thanks for helping out. Here is all you need.

## Propose a change

Start with an [issue](https://github.com/Mats-TH/pixeldesk-mod/issues), for bugs and ideas alike. The templates ask for what we need.

Agree on the idea there, then open a pull request.

## Install from your folder

You need a recent Claude Code. Version 2.1.309 has every command below.

Clone the repository and go into it. To try the mod for one session:

```
claude --plugin-dir .
```

To install it from the folder:

```
claude plugin install pixeldesk --marketplace ./
```

## Run the tests and the validator

```
claude plugin test .
claude plugin validate .
```

Both also run on every pull request, on Linux, Windows and macOS.

## Style

- TypeScript with no semicolons and single quotes. Match the file you are in.
- Small modules, and short comments in English.
- Every text a person or the model reads goes through `hooks/i18n.ts`, in both French and English. Logs stay in English.
- The mod must never break a conversation. Risky work goes through `guard` from `hooks/disk.ts`.
- Public texts never use em dashes or en dashes. Use a comma, a colon, a period or parentheses.

## Design first

Any visual change starts with a design, before the code. Open an issue with a mockup or a sketch, in the pixel style of the mod.
