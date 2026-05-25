import { App, FuzzySuggestModal, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

export interface contextualGuideRule {
	name: string;
	guideTitle?: string;
	requiredTags: string[];
	guideNotePath: string;
	guideContent?: string;
}

export interface contextualGuideSettings {
	guideRules: contextualGuideRule[];
}

type contextualGuideSettingsPlugin = Plugin & {
	settings: contextualGuideSettings;
	saveSettings(): Promise<void>;
};

export const DEFAULT_SETTINGS: contextualGuideSettings = {
	guideRules: [
		{
			name: 'Article notes',
			requiredTags: ['article', 'draft'],
			guideNotePath: '',
		},
	],
};

export class contextualGuideSettingTab extends PluginSettingTab {
	plugin: contextualGuideSettingsPlugin;

	constructor(app: App, plugin: contextualGuideSettingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('p', {
			text: 'Contextual guides appear in the right sidebar when the active note contains all tags defined by a rule.',
		});

		new Setting(containerEl)
			.setName('Add guide')
			.setDesc('Create another tag-based contextual guide')
			.addButton((button) => button
				.setButtonText('Add guide')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.guideRules.push(createEmptyGuideRule());
					await this.plugin.saveSettings();
					this.display();
				}));

		this.plugin.settings.guideRules.forEach((rule, index) => {
			const sectionEl = containerEl.createDiv({ cls: 'contextual-guide-setting contextual-guide-rule' });

			const headerEl = sectionEl.createDiv({ cls: 'contextual-guide-rule-header' });
			headerEl.createDiv({ cls: 'contextual-guide-rule-title', text: rule.name || `Guide ${index + 1}` });
			const removeButton = headerEl.createEl('button', {
				cls: 'mod-warning contextual-guide-compact-button',
				text: 'Remove',
			});
			removeButton.addEventListener('click', () => {
				void (async () => {
					this.plugin.settings.guideRules.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				})();
			});

			const gridEl = sectionEl.createDiv({ cls: 'contextual-guide-rule-grid' });

			const ruleNameFieldEl = gridEl.createDiv({ cls: 'contextual-guide-field' });
			ruleNameFieldEl.createEl('label', { text: 'Rule name' });
			const ruleNameInput = ruleNameFieldEl.createEl('input', {
				type: 'text',
				cls: 'contextual-guide-compact-input',
				placeholder: 'Example: Meeting notes',
				value: rule.name,
			});
			ruleNameInput.addEventListener('change', () => {
				void (async () => {
					rule.name = ruleNameInput.value.trim();
					await this.plugin.saveSettings();
					this.display();
				})();
			});

			const guideTitleFieldEl = gridEl.createDiv({ cls: 'contextual-guide-field' });
			guideTitleFieldEl.createEl('label', { text: 'Guide panel title' });
			const guideTitleInput = guideTitleFieldEl.createEl('input', {
				type: 'text',
				cls: 'contextual-guide-compact-input',
				placeholder: 'Contextual guide',
				value: rule.guideTitle ?? '',
			});
			guideTitleInput.addEventListener('change', () => {
				void (async () => {
					rule.guideTitle = guideTitleInput.value.trim();
					await this.plugin.saveSettings();
				})();
			});

			const tagsFieldEl = gridEl.createDiv({ cls: 'contextual-guide-field contextual-guide-field-span' });
			tagsFieldEl.createEl('label', { text: 'Required tags' });
			const tagsControlsEl = tagsFieldEl.createDiv({ cls: 'contextual-guide-inline-controls' });
			const tagsInput = tagsControlsEl.createEl('input', {
				type: 'text',
				cls: 'contextual-guide-compact-input',
				placeholder: 'project/spec, article/draft',
				value: rule.requiredTags.join(', '),
			});
			attachTagSuggestions(tagsInput, this.app);
			tagsInput.addEventListener('change', () => {
				void (async () => {
					rule.requiredTags = parseTagList(tagsInput.value);
					await this.plugin.saveSettings();
				})();
			});
			const pickTagButton = tagsControlsEl.createEl('button', {
				cls: 'contextual-guide-compact-button',
				text: 'Pick',
			});
			pickTagButton.addEventListener('click', () => {
				new TagSuggestModal(this.app, async (tag) => {
					const normalized = normalizeTag(tag);
					if (!rule.requiredTags.includes(normalized)) {
						rule.requiredTags.push(normalized);
						await this.plugin.saveSettings();
						this.display();
					}
				}).open();
			});

			const notePathFieldEl = gridEl.createDiv({ cls: 'contextual-guide-field contextual-guide-field-span' });
			notePathFieldEl.createEl('label', { text: 'Guide note path' });
			const notePathControlsEl = notePathFieldEl.createDiv({ cls: 'contextual-guide-inline-controls' });
			const notePathInput = notePathControlsEl.createEl('input', {
				type: 'text',
				cls: 'contextual-guide-compact-input',
				placeholder: 'Guides/article-guide.md',
				value: rule.guideNotePath,
			});
			attachNotePathSuggestions(notePathInput, this.app);
			notePathInput.addEventListener('change', () => {
				void (async () => {
					rule.guideNotePath = notePathInput.value.trim();
					await this.plugin.saveSettings();
				})();
			});
			const browseNoteButton = notePathControlsEl.createEl('button', {
				cls: 'contextual-guide-compact-button',
				text: 'Browse',
			});
			browseNoteButton.addEventListener('click', () => {
				new GuideNoteSuggestModal(this.app, async (file) => {
					rule.guideNotePath = file.path;
					await this.plugin.saveSettings();
					this.display();
				}).open();
			});
			const clearNoteButton = notePathControlsEl.createEl('button', {
				cls: 'contextual-guide-compact-button',
				text: 'Clear',
			});
			clearNoteButton.addEventListener('click', () => {
				void (async () => {
					rule.guideNotePath = '';
					await this.plugin.saveSettings();
					this.display();
				})();
			});
		});
	}
}

function createEmptyGuideRule(): contextualGuideRule {
	return {
		name: '',
		guideTitle: '',
		requiredTags: [],
		guideNotePath: '',
	};
}

class GuideNoteSuggestModal extends FuzzySuggestModal<TFile> {
	private readonly files: TFile[];
	private readonly onChoose: (file: TFile) => Promise<void>;

	constructor(app: App, onChoose: (file: TFile) => Promise<void>) {
		super(app);
		this.files = app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
		this.onChoose = onChoose;
		this.setPlaceholder('Select a guide note...');
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		void this.onChoose(file);
	}
}

class TagSuggestModal extends FuzzySuggestModal<string> {
	private readonly tags: string[];
	private readonly onChoose: (tag: string) => Promise<void>;

	constructor(app: App, onChoose: (tag: string) => Promise<void>) {
		super(app);
		this.tags = collectAvailableTags(app);
		this.onChoose = onChoose;
		this.setPlaceholder('Pick a tag...');
	}

	getItems(): string[] {
		return this.tags;
	}

	getItemText(tag: string): string {
		return tag;
	}

	onChooseItem(tag: string): void {
		void this.onChoose(tag);
	}
}

function attachTagSuggestions(inputEl: HTMLInputElement, app: App) {
	const datalistId = createUniqueDataListId('tag-suggestions');
	const dataList = inputEl.createEl('datalist', { attr: { id: datalistId } });
	for (const tag of collectAvailableTags(app)) {
		dataList.createEl('option', { value: tag });
	}
	inputEl.setAttr('list', datalistId);
}

function attachNotePathSuggestions(inputEl: HTMLInputElement, app: App) {
	const datalistId = createUniqueDataListId('guide-note-paths');
	const dataList = inputEl.createEl('datalist', { attr: { id: datalistId } });
	for (const file of app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path))) {
		dataList.createEl('option', { value: file.path });
	}
	inputEl.setAttr('list', datalistId);
}

function createUniqueDataListId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function collectAvailableTags(app: App): string[] {
	const tags = new Set<string>();
	for (const file of app.vault.getMarkdownFiles()) {
		const cache = app.metadataCache.getFileCache(file);
		for (const tag of cache?.tags ?? []) {
			tags.add(normalizeTag(tag.tag));
		}

		const frontmatterTags = cache?.frontmatter?.tags as string | string[] | undefined;
		if (typeof frontmatterTags === 'string') {
			for (const tag of frontmatterTags.split(',')) {
				tags.add(normalizeTag(tag));
			}
		} else if (Array.isArray(frontmatterTags)) {
			for (const tag of frontmatterTags) {
				if (typeof tag === 'string') {
					tags.add(normalizeTag(tag));
				}
			}
		}
	}

	tags.delete('');
	return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, '').toLowerCase();
}

function parseTagList(value: string): string[] {
	return value
		.split(',')
		.map((tag) => normalizeTag(tag))
		.filter(Boolean);
}
