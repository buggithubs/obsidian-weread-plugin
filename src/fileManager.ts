import { Vault, MetadataCache, TFile, TFolder, Notice } from 'obsidian';
import { Renderer } from './renderer';
import { sanitizeTitle } from './utils/sanitizeTitle';
import type { Highlight, Metadata, Notebook } from './models';
import { frontMatterDocType, addFrontMatter, updateFrontMatter } from './utils/frontmatter';
import { get } from 'svelte/store';
import { settingsStore } from './settings';

export type AnnotationFile = {
	bookId?: string;
	noteCount: number;
	reviewCount: number;
	new: boolean;
	file: TFile;
};

export default class FileManager {
	private vault: Vault;
	private metadataCache: MetadataCache;
	private renderer: Renderer;

	constructor(vault: Vault, metadataCache: MetadataCache) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		this.renderer = new Renderer();
	}

	public async saveDailyNotes(metaData: Metadata, highlights: Highlight[]) {
		const dailyNotePath = this.getDailyNotePath();
		console.log('get daily note path', dailyNotePath);
		const fileExist = await this.fileExists(dailyNotePath);
		if (!fileExist) {
			new Notice('没有找到Daily Note，请先创建' + dailyNotePath);
			return;
		}

		const fileContent = this.buildAppendContent(metaData, highlights);
		const dailyNoteFile = await this.getFileByPath(dailyNotePath);
		const existFileContent = await this.vault.cachedRead(dailyNoteFile);
		this.vault.modify(dailyNoteFile, existFileContent + '\n' + fileContent);
	}

	private buildAppendContent(metaData: Metadata, highlights: Highlight[]): string {
		const readingNotesRef = highlights.map((highlight) => {
			return `![[${metaData.title}#^${highlight.bookmarkId}]]`;
		});
		const headContent: string = '### '.concat(metaData.title).concat('\n');
		const bodyContent = readingNotesRef.join('\n');
		const finalContent = headContent + bodyContent;
		return finalContent;
	}

	private getDailyNotePath(): string {
		let dailyNoteFileName;
		const dailyNotesFormat = get(settingsStore).dailyNotesFormat;

		try {
			dailyNoteFileName = window.moment().format(dailyNotesFormat);
		} catch (e) {
			new Notice('Daily Notes 日期格式不正确' + dailyNotesFormat);
			throw e;
		}
		const dailyNotesLocation = get(settingsStore).dailyNotesLocation;
		return dailyNotesLocation + '/' + dailyNoteFileName + '.md';
	}

	private async fileExists(filePath: string): Promise<boolean> {
		return await this.vault.adapter.exists(filePath);
	}

	private async getFileByPath(filePath: string): Promise<TFile> {
		const file: TAbstractFile = await this.vault.getAbstractFileByPath(filePath);

		if (!file) {
			console.error(`${filePath} not found`);
			return null;
		}

		if (file instanceof TFolder) {
			console.error(`${filePath} found but it's a folder`);
			return null;
		}

		if (file instanceof TFile) {
			return file;
		}
	}

	public async saveNotebook(notebook: Notebook, localFile: AnnotationFile): Promise<void> {
		if (localFile) {
			if (localFile.new) {
				const existingFile = localFile.file;
				console.log(`Updating ${existingFile.path}`);
				const existFileContent = await this.vault.cachedRead(existingFile);
				const freshContent = this.renderer.render(notebook);
				const fileContent = updateFrontMatter(freshContent, notebook, existFileContent);
				await this.vault.modify(existingFile, fileContent);
			}
		} else {
			const newFilePath = await this.getNewNotebookFilePath(notebook);
			console.log(`Creating ${newFilePath}`);
			const markdownContent = this.renderer.render(notebook);
			const fileContent = addFrontMatter(markdownContent, notebook);
			await this.vault.create(newFilePath, fileContent);
		}
	}

	public async getNotebookFiles(): Promise<AnnotationFile[]> {
		const files = this.vault.getMarkdownFiles();
		return files
			.map((file) => {
				const cache = this.metadataCache.getFileCache(file);
				return { file, frontmatter: cache?.frontmatter };
			})
			.filter(({ frontmatter }) => frontmatter?.['doc_type'] === frontMatterDocType)
			.map(
				({ file, frontmatter }): AnnotationFile => ({
					file,
					bookId: frontmatter['bookId'],
					reviewCount: frontmatter['reviewCount'],
					noteCount: frontmatter['noteCount'],
					new: false
				})
			);
	}

	private async getNewNotebookFilePath(notebook: Notebook): Promise<string> {
		const folderPath = `${get(settingsStore).noteLocation}/${this.getSubFolderPath(
			notebook.metaData
		)}`;
		if (!(await this.vault.adapter.exists(folderPath))) {
			console.info(`Folder ${folderPath} not found. Will be created`);
			await this.vault.createFolder(folderPath);
		}
		const fileName = this.getFileName(notebook.metaData);
		const filePath = `${folderPath}/${fileName}.md`;
		return filePath;
	}

	private getFileName(metaData: Metadata): string {
		const fileNameType = get(settingsStore).fileNameType;
		const baseFileName = sanitizeTitle(metaData.title);
		if (fileNameType == 'BOOK_NAME-AUTHOR') {
			if (metaData.duplicate) {
				return `${baseFileName}-${metaData.author}-${metaData.bookId}`;
			}
			return `${baseFileName}-${metaData.author}`;
		} else {
			if (metaData.duplicate || fileNameType == 'BOOK_NAME-BOOKID') {
				return `${baseFileName}-${metaData.bookId}`;
			}
			return baseFileName;
		}
	}

	private getSubFolderPath(metaData: Metadata): string {
		const folderType = get(settingsStore).subFolderType;
		if (folderType == 'title') {
			return metaData.title;
		} else if (folderType == 'category') {
			if (metaData.category) {
				return metaData.category.split('-')[0];
			} else {
				return metaData.author === '公众号' ? '公众号' : '未分类';
			}
		}
		return '';
	}
}
