# Contextual Guides

Contextual Guides shows a note in a right sidebar based on tags in your active note. Useful for style guides, contextual guidelines, or metadata requirements.

## What It Does

- Adds a right-sidebar view called Contextual guide.
- Lets you define one or more guide rules in plugin settings.
- Matches rules when the active note contains all required tags.
- Renders the selected guide note in the sidebar.

## Usage

1. Open plugin settings.
2. Select Add guide.
3. Configure Rule name, Guide panel title, Required tags, and Guide note path.
4. Open a note that contains all required tags.
5. Open the sidebar with the ribbon icon or command Open contextual guide sidebar.

## Rule Matching Notes

- Tags are normalized (case-insensitive, with leading # removed).
- A rule only matches when all required tags are present.
- If no rule matches, the sidebar shows an empty-state message.
- If a rule has no valid guide note path, the sidebar shows a configuration warning.

## Development

Requirements:
- Node.js 18+
- npm

Commands:

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Manual Install For Testing

Copy these files to your vault plugin folder:

- `main.js`
- `manifest.json`
- `styles.css`

Path:

```text
<Vault>/.obsidian/plugins/contextual-guides/
```

## Release Checklist

1. Bump `version` in `manifest.json` and `package.json`.
2. Add/update the same version in `versions.json` with the minimum supported Obsidian version.
3. Run `npm run build` and `npm run lint`.
4. Create a GitHub release tag that exactly matches the version (no leading `v`).
5. Attach `manifest.json`, `main.js`, and `styles.css` to the release.
6. Publish the release and submit/update your listing in `obsidian-releases`.

## Privacy And Security

- The plugin operates on local vault metadata and files.
- No external network requests are required for core functionality.
