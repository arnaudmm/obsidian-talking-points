# Talking Points

Talking Points is an Obsidian plugin to manage agenda items to discuss during meetings.

- Each item is a normal note with properties (`type: agenda`, `audiences`, `pending`), so search and Bases can see it.
- Audiences are your own notes: any note with `type: person` or `type: meeting` is one, named after the note. Nothing is kept in the settings, and the same person notes work with other plugins that read `type: person`.
- An `agenda` block in a person or meeting note lists what is still pending for that audience.
- Ticking an item asks for an optional one-line outcome, which is kept in the item's `## Log`. Each audience is ticked off on its own.

It requires Obsidian 1.13 or later.

## Use

1. Add `type: person` to the properties of each person's note, and `type: meeting` to each meeting's note (a daily, a retrospective…). Add `active: false` to hide one from the pickers without deleting it.
2. Run **Talking Points: New agenda item** (bind it to a hotkey). Type the title, tick the audiences, and press ⌘Enter to save, or ⌘⇧Enter to save and enter the next one.
3. In each person or meeting note, add an empty block once. It lists what is pending for that note:
   ````
   ```agenda
   ```
   ````
   In any other note, name the audience: `audience: Daily` or `audience: [[Daily]]`.
4. In the meeting, tick what you've covered. **Show done** lists the last 30 days with their outcomes.
5. For an overview of everything pending, put this block anywhere (a home or weekly review note):
   ````
   ```agenda
   audience: all
   layout: items
   ```
   ````
   `layout: items` is optional: it shows a table of items × audiences, and without it the items are grouped by audience. In the table, `●` is still to tell (click it to tick that audience) and `✓` is already told. Every row shows the item's age.

Items refer to their audiences with links (`audiences: ["[[Marc]]"]`, and `- 2026-11-20 · [[Marc]] · outcome` in the `## Log`), so renaming a person or meeting note updates them, as long as Settings → Files and links → Automatically update internal links is on. An empty block follows its note's new name; a block with an `audience:` line keeps the name you typed.

## Commands

Run them from the command palette (⌘P on macOS, Ctrl+P elsewhere). They have no default hotkeys: bind them in Settings → Hotkeys.

| Command | What it does |
|---|---|
| **Talking Points: New agenda item** | Opens the capture window: a title, optional details, and one checkbox per audience. **Save** (⌘Enter) creates the item note in the item folder and closes the window. **Save & next** (⌘⇧Enter) creates it and clears the window for the next item. At least one audience must be ticked. If no note has `type: person` or `type: meeting` yet, it says so. |
| **Talking Points: Edit audiences of this agenda item** | Available only when the open note is an agenda item (`type: agenda`). Shows a checkbox per audience, ticked for those still pending. Ticking one adds it to the item's `audiences` and `pending`. Unticking one removes it from `pending` only, so `audiences` keeps the record. Audiences that are on the item but have no note are listed as "(no note)", and those with `active: false` as "(inactive)". |

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

To try changes in a local vault, build and copy the plugin in one step. `OBSIDIAN_VAULT` is the path to your vault (the folder that contains `.obsidian`); put the `export` in your shell profile to set it once:

```sh
export OBSIDIAN_VAULT="$HOME/Documents/MyVault"
npm run deploy-locally
```

It copies `manifest.json`, `main.js` and `styles.css` into `$OBSIDIAN_VAULT/.obsidian/plugins/talking-points/`, creating the folder if needed, and leaves `data.json` (the settings) alone. Then turn the plugin off and on in Obsidian, or use the Hot Reload plugin.

## Installing

Build, then copy only the three files Obsidian loads:

```sh
npm run build
mkdir -p "<vault>/.obsidian/plugins/talking-points"
cp manifest.json main.js styles.css "<vault>/.obsidian/plugins/talking-points/"
```

## Releasing

Releases are GitHub releases whose tag is the bare version (`0.2.0`, not `v0.2.0`), with `main.js`, `manifest.json` and `styles.css` attached. That is what Obsidian and BRAT install from.

```sh
npm version patch   # or minor / major; 1.0.0-beta.1 style versions become pre-releases
git push --follow-tags
```

`npm version` updates the version in `package.json` and `manifest.json` and adds it to `versions.json`, with the `minAppVersion` it needs. It then commits the change and creates the tag. Pushing the tag runs `.github/workflows/release.yml`, which checks that the tag matches the manifest, runs `npm run verify`, and creates the release. To require a newer Obsidian, change `minAppVersion` in `manifest.json` before bumping.

## License

MIT, see [LICENSE](LICENSE).
