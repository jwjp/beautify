# Contributing to Beautify

Thanks for helping make Beautify better. Bug reports, ideas, translations, and pull requests are welcome.

1. Open an issue for a larger change so we can discuss the behavior first.
2. Fork the repository and create a focused branch.
3. Run `npm install`, `npm test`, and `npm run build` before opening a pull request.
4. In the pull request, describe the behavior change and add screenshots for interface changes.

Please keep English and Korean UI strings in sync in `src/i18n.ts`. Formatter behavior lives in `src/formatter.ts`; add a focused test when changing parsing or output behavior.
