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

## Privacy And Security

- The plugin operates on local vault metadata and files.
- No external network requests are required for core functionality.
