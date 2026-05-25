import { ItemView, MarkdownRenderer, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, contextualGuideRule, contextualGuideSettingTab, contextualGuideSettings } from './settings';

const VIEW_TYPE_contextual_GUIDE = 'contextual-guide-sidebar-view';

export default class contextualGuidePlugin extends Plugin {
	settings!: contextualGuideSettings;

	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE_contextual_GUIDE, (leaf) => new contextualGuideView(leaf, this));

		this.addRibbonIcon('book-check', 'Open contextual guide', async () => {
			await this.activateView();
		});

		this.addCommand({
			id: 'open-contextual-guide-sidebar',
			name: 'Open contextual guide sidebar',
			callback: () => {
				void this.activateView();
			}
		});

		this.addSettingTab(new contextualGuideSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('file-open', () => {
			void this.refreshGuideViews();
		}));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			void this.refreshGuideViews();
		}));
		this.registerEvent(this.app.metadataCache.on('changed', (file) => {
			const activeFile = this.getActiveMarkdownFile();
			if (activeFile && file.path === activeFile.path) {
				void this.refreshGuideViews();
			}
		}));

		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
			void this.refreshGuideViews();
		});
	}

	async activateView() {
		const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_contextual_GUIDE)[0];
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(true);
		if (!leaf) {
			new Notice('Could not create right sidebar leaf');
			return;
		}

		await leaf.setViewState({
			type: VIEW_TYPE_contextual_GUIDE,
			active: true,
			state: {},
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	async refreshGuideViews() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_contextual_GUIDE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof contextualGuideView) {
				await view.render();
			}
		}
	}

	getActiveMarkdownFile(): TFile | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
	}

	getMatchingGuideForFile(file: TFile): contextualGuideRule | null {
		const noteTags = this.getNormalizedTagsForFile(file);
		return this.settings.guideRules.find((rule) => {
			return rule.requiredTags.length > 0 && rule.requiredTags.every((tag) => noteTags.has(normalizeTag(tag)));
		}) ?? null;
	}

	async getGuideContent(rule: contextualGuideRule): Promise<string | null> {
		if (rule.guideNotePath) {
			const guideFile = this.app.vault.getAbstractFileByPath(rule.guideNotePath);
			if (guideFile instanceof TFile) {
				return await this.app.vault.cachedRead(guideFile);
			}
			return null;
		}

		if (rule.guideContent) {
			return rule.guideContent;
		}

		return null;
	}

	getNormalizedTagsForFile(file: TFile): Set<string> {
		const normalizedTags = new Set<string>();
		const cache = this.app.metadataCache.getFileCache(file);

		for (const tag of cache?.tags ?? []) {
			addNormalizedTag(normalizedTags, tag.tag);
		}

		const frontmatterTags = cache?.frontmatter?.tags as string | string[] | undefined;
		if (typeof frontmatterTags === 'string') {
			for (const tag of frontmatterTags.split(',')) {
				addNormalizedTag(normalizedTags, tag);
			}
		} else if (Array.isArray(frontmatterTags)) {
			for (const tag of frontmatterTags) {
				if (typeof tag === 'string') {
					addNormalizedTag(normalizedTags, tag);
				}
			}
		}

		return normalizedTags;
	}

	async loadSettings() {
		const loadedSettings = await this.loadData() as Partial<contextualGuideSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedSettings,
			guideRules: loadedSettings?.guideRules ?? DEFAULT_SETTINGS.guideRules,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.refreshGuideViews();
	}
}

class contextualGuideView extends ItemView {
	plugin: contextualGuidePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: contextualGuidePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_contextual_GUIDE;
	}

	getDisplayText() {
		return 'Contextual guide';
	}

	getIcon() {
		return 'book-check';
	}

	async onOpen() {
		await this.render();
	}

	async render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('contextual-guide-view');

		const headerEl = contentEl.createDiv({ cls: 'contextual-guide-header' });
		const bodyEl = contentEl.createDiv({ cls: 'contextual-guide-body' });
		const footerEl = contentEl.createDiv({ cls: 'contextual-guide-footer' });

		const activeFile = this.plugin.getActiveMarkdownFile();
		if (!activeFile) {
			renderEmptyState(bodyEl, 'Open a note to see its contextual guide.');
			return;
		}

		const noteTags = this.plugin.getNormalizedTagsForFile(activeFile);
		const matchingGuide = this.plugin.getMatchingGuideForFile(activeFile);
		const guidePanelTitle = matchingGuide?.guideTitle?.trim() || 'Contextual guide';
		const displayedTags = matchingGuide
			? matchingGuide.requiredTags
				.map((tag) => normalizeTag(tag))
				.filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index && noteTags.has(tag))
			: [];
		const headerLineEl = headerEl.createDiv({ cls: 'contextual-guide-title-line' });
		headerLineEl.createEl('div', {
			cls: 'contextual-guide-title',
			text: guidePanelTitle,
		});

		if (displayedTags.length > 0) {
			const tagListEl = headerLineEl.createDiv({ cls: 'contextual-guide-tags' });
			for (const tag of displayedTags) {
				tagListEl.createEl('span', {
					cls: 'contextual-guide-tag',
					text: `#${tag}`,
				});
			}
		}

		headerEl.createEl('div', { cls: 'contextual-guide-label', text: `Current note: ${activeFile.basename}` });

		if (!matchingGuide) {
			renderEmptyState(bodyEl, 'No guide matches this note yet. Add a rule in the plugin settings with the tags that should trigger a guide.');
			return;
		}

		const guideContent = await this.plugin.getGuideContent(matchingGuide);
		if (!guideContent) {
			renderEmptyState(bodyEl, 'This rule does not have a valid guide note selected. Select one in the plugin settings.');
			return;
		}

		const guideContentEl = bodyEl.createDiv({ cls: 'contextual-guide-content' });
		const guideMarkdownEl = guideContentEl.createDiv({ cls: 'contextual-guide-markdown markdown-rendered' });
		const cleanedGuideContent = stripFrontmatter(guideContent);
		await MarkdownRenderer.render(
			this.app,
			cleanedGuideContent,
			guideMarkdownEl,
			matchingGuide.guideNotePath || activeFile.path,
			this,
		);

		footerEl.createEl('div', {
			cls: 'contextual-guide-footer-line',
			text: `Shown because this note matches: ${matchingGuide.requiredTags.map((tag) => `#${normalizeTag(tag)}`).join(', ')}`,
		});
		if (matchingGuide.guideNotePath) {
			footerEl.createEl('div', {
				cls: 'contextual-guide-footer-line',
				text: `Guide note: ${matchingGuide.guideNotePath}`,
			});
		}
	}

	async onClose() {
		this.contentEl.empty();
	}
}

function renderEmptyState(containerEl: HTMLElement, message: string) {
	containerEl.createEl('div', {
		cls: 'contextual-guide-empty-state',
		text: message,
	});
}

function addNormalizedTag(target: Set<string>, value: string) {
	const normalizedTag = normalizeTag(value);
	if (normalizedTag) {
		target.add(normalizedTag);
	}
}

function normalizeTag(value: string): string {
	return value.trim().replace(/^#/, '').toLowerCase();
}

function stripFrontmatter(content: string): string {
	return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}
