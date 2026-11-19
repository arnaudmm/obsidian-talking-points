# Agenda

An Obsidian plugin to manage agenda items to discuss during meetings.

- Each item is a normal note with properties (`type: agenda`, `audiences`, `pending`), so search and Bases can see it.
- You pick audiences (people, daily meeting, retrospective..) from a fixed list in the settings; you never type them.
- An `agenda` block in a person or meeting note lists what is still pending for that audience.
- Ticking an item asks for an optional one-line outcome, which is kept in the item's `## Log`. Each audience is ticked off on its own.

## Use

1. In Settings → Agenda, add your audiences.
2. Run **Agenda: New item** (bind it to a hotkey). Type the title, tick the audiences, and press ⌘Enter to save, or ⌘⇧Enter to save and enter the next one.
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

**Agenda: Edit audiences of this item** changes an item's audiences from its note. Renaming an audience in the settings updates the item notes, their logs and the blocks.

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
- The rest of `src/` is the Obsidian side: type-checked, and checked by hand with [TESTING.md](TESTING.md).

## Installing

Build, then copy only the three files Obsidian loads:

```sh
npm run build
mkdir -p "<vault>/.obsidian/plugins/agenda"
cp manifest.json main.js styles.css "<vault>/.obsidian/plugins/agenda/"
