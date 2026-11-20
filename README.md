# Talking Points

Talking Points is an Obsidian plugin to manage agenda items to discuss during meetings.

- Each item is a normal note with properties (`type: agenda`, `audiences`, `pending`), so search and Bases can see it.
- You pick audiences (people, daily meeting, retrospective..) from a fixed list in the settings; you never type them.
- An `agenda` block in a person or meeting note lists what is still pending for that audience.
- Ticking an item asks for an optional one-line outcome, which is kept in the item's `## Log`. Each audience is ticked off on its own.

It requires Obsidian 1.13 or later.

## Use

1. In Settings → Talking Points, add your audiences with the **+** button. Drag them to reorder, use the pencil to rename, or delete them.
2. Run **Talking Points: New agenda item** (bind it to a hotkey). Type the title, tick the audiences, and press ⌘Enter to save, or ⌘⇧Enter to save and enter the next one.
3. In each person or meeting note, add a block once:
   ````
   ```agenda
   audience: daily
   ```
   ````
4. In the meeting, tick what you've covered. **Show done** lists the last 30 days with their outcomes.
5. For an overview of everything pending, put this block anywhere (a home or weekly review note):
   ````
   ```agenda
   audience: all
   layout: items
   ```
   ````
   `layout: items` is optional: it shows a table of items × audiences, and without it the items are grouped by audience. In the table, `●` is still to tell (click it to tick that audience) and `✓` is already told. Every row shows the item's age.

**Talking Points: Edit audiences of this agenda item** changes an item's audiences from its note. Renaming an audience in the settings updates the item notes, their logs and the blocks.

## Development

It needs Node 24 or newer.

```sh
npm install
npm run check     # type-check against the Obsidian API
npm test          # unit tests (node --test, TypeScript run directly)
npm run build     # bundle src/main.ts to main.js (npm run dev adds a source map)
npm run verify    # all three
```

The layout:

- `src/core/` is pure logic with no `obsidian` import, tested in Node.
- `src/actions.ts` holds the writes, behind a small `Store` interface, and is tested with an in-memory fake.
- The rest of `src/` is the Obsidian side: type-checked here, and checked by hand in Obsidian.

## Installing

Build, then copy only the three files Obsidian loads:

```sh
npm run build
mkdir -p "<vault>/.obsidian/plugins/talking-points"
cp manifest.json main.js styles.css "<vault>/.obsidian/plugins/talking-points/"

## Releasing

Releases are GitHub releases whose tag is the bare version (`0.2.0`, not `v0.2.0`), with `main.js`, `manifest.json` and `styles.css` attached. That is what Obsidian and BRAT install from.

```sh
npm version patch   # or minor / major; 1.0.0-beta.1 style versions become pre-releases
git push --follow-tags
```

`npm version` updates the version in `package.json` and `manifest.json` and adds it to `versions.json`, with the `minAppVersion` it needs. It then commits the change and creates the tag. Pushing the tag runs `.github/workflows/release.yml`, which checks that the tag matches the manifest, runs `npm run verify`, and creates the release. To require a newer Obsidian, change `minAppVersion` in `manifest.json` before bumping.

## License

MIT, see [LICENSE](LICENSE).
