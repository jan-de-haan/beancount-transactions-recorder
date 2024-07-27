import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, type MarkdownFileInfo, FileSystemAdapter, normalizePath, EditorPosition } from 'obsidian';
import TransactionEditor from './TransactionEditor.svelte';
import { Transaction, TransactionPart, parseTransaction, renderTransaction } from './Transaction';

// Remember to rename these classes and interfaces!

const currencyIcon = ['euro', 'dollar-sign', 'indian-rupee', 'japanese-yen', 'pound-sterling', 'russian-ruble', 'swiss-franc'] as const;
type CurrencyIcon = (typeof currencyIcon)[number];
const isCurrencyIcon = (x: any): x is CurrencyIcon => currencyIcon.includes(x);

interface BeancountTransactionsRecorderSettings {
	saveFilePattern: string;
	currencyIcon: CurrencyIcon;
	currencyIsoCode: string;
	beancountFileForAccounts: string;
	fromAccountLastUses: Record<string, number>;
	toAccountLastUses: Record<string, number>;
}

const DEFAULT_SETTINGS: BeancountTransactionsRecorderSettings = {
	saveFilePattern: 'Finances/Books/{YYYY}/{MM}/{YYYY}-{MM}',
	currencyIcon: 'euro',
	currencyIsoCode: 'EUR',
	beancountFileForAccounts: '',
	fromAccountLastUses: {},
	toAccountLastUses: {},
}

async function getAccountsFromSettings(settings: BeancountTransactionsRecorderSettings, fsa: FileSystemAdapter): Promise<string[]> {
	try {
		let path = normalizePath(settings.beancountFileForAccounts + '.md');
		let content = await fsa.read(path);
		let lines = content.split('\n');
		let accounts: string[] = [];
		lines.forEach(line => {
			let match = line.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2} open (.*)$/);
			if(match !== null) {
				accounts.push(match[1]);
			}
		});
		return accounts;
	} catch {
		return [];
	}

}

export default class BeancountTransactionsRecorderPlugin extends Plugin {
	settings: BeancountTransactionsRecorderSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(this.settings.currencyIcon, 'Beancount Transactions Recorder', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Test!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('obsidian-beancount-ribbon-item-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'record-beancount-transaction',
			name: 'Record a Beancount transaction',
			callback: () => {
				new TransactionModal(this.app, this, null, async t => {
					let year = t.dateIsoStr.slice(0, 4);
					let month = t.dateIsoStr.slice(5, 7);
					let day = t.dateIsoStr.slice(8, 10);
					let path = normalizePath(this.settings.saveFilePattern.replace(/\{YYYY\}/g, year).replace(/\{MM\}/g, month).replace(/\{DD\}/g, day) + '.md');
					let fsa = this.app.vault.adapter as FileSystemAdapter;
					if (!await fsa.exists(path)) {
						let cumPath = '';
						let segments = path.split('/').slice(0, -1);
						for(let i = 0; i < segments.length; i++) {
							let segment = segments[i];
							cumPath += segment + '/';
							if (!await fsa.exists(normalizePath(cumPath))) {
								fsa.mkdir(normalizePath(cumPath));
							}
						}
						fsa.write(path, '');
					}
					let content = await fsa.read(path);
					let lines = content.split('\n');
					let emptyLinesAtEnd = lines.length - lines.findLastIndex(s => s !== '') - 1;
					let emptyLinesToAdd = emptyLinesAtEnd == 1 ? 1 : 2;
					let strToAppend = '';
					for(let i = 0; i < emptyLinesToAdd; i++) {
						strToAppend += '\n';
					}
					strToAppend += renderTransaction(t);
					fsa.append(path, strToAppend);
				}).open();
			},
		});
		this.addCommand({
			id: 'modify-beancount-transaction',
			name: 'Modify the selected Beancount transaction',
			editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				function lineIsTransactionPart(line: string) {
					return line.match(/^  .* -?[0-9.]+ EUR$/) !== null;
				}

				function lineIsFirstTransactionLine(line: string) {
					return line.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2} \* ".*" ".*"$/) !== null;
				}

				let cursor = editor.getCursor();
				let firstLineNumber = cursor.line;
				let currentLine = editor.getLine(firstLineNumber);
				if(!lineIsFirstTransactionLine(currentLine)) {
					if(!lineIsTransactionPart(currentLine)) {
						new Notice("Cannot find transaction here", 1500);
						return;
					}
					while(lineIsTransactionPart(currentLine)) {
						firstLineNumber -= 1;
						currentLine = editor.getLine(firstLineNumber);
					}
					if(!lineIsFirstTransactionLine(currentLine)) {
						new Notice("Cannot find transaction here", 1500);
						return;
					}
				}
				let lastLineNumber = firstLineNumber + 1;
				currentLine = editor.getLine(lastLineNumber);
				if(!lineIsTransactionPart(currentLine)) {
					new Notice("Cannot find transaction here", 1500);
					return;
				}
				while(lineIsTransactionPart(currentLine)) {
					lastLineNumber += 1;
					currentLine = editor.getLine(lastLineNumber);
				}
				lastLineNumber -= 1;

				let from = {line: firstLineNumber, ch: 0};
				let to = {line: lastLineNumber + 1, ch: 0};

				let transactionStr = editor.getRange(from, to);

				let existingTransaction = parseTransaction(transactionStr);
				if(existingTransaction === null) {
					new Notice("Cannot parse transaction", 1500);
					return;
				}
				new TransactionModal(this.app, this, existingTransaction, t => {
					let changedTransactionStr = renderTransaction(t);

					editor.replaceRange(changedTransactionStr, from, to);
				}).open();
			}
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new BeancountTransactionsRecorderSettingsTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TransactionModal extends Modal {
	transactionEditor?: TransactionEditor;
	plugin: BeancountTransactionsRecorderPlugin;
	finishedCallback: (t: Transaction) => void;
	existingTransaction: Transaction;

	constructor(app: App, plugin: BeancountTransactionsRecorderPlugin, existingTransaction: Transaction | null, finishedCallback: (t: Transaction) => void) {
		super(app);

		this.plugin = plugin;
		if (existingTransaction) {
			this.existingTransaction = existingTransaction;
		} else {
			this.existingTransaction = {
				dateIsoStr: new Date().toISOString().slice(0, 10),
				otherPartyName: '',
				description: '',
				fromParts: [{id: 0, account: '', amount: 0}],
				toParts: [{id: 1, account: '', amount: 0}],
			}
		}
		this.finishedCallback = finishedCallback;
	}

	async onOpen() {
		let accounts = await getAccountsFromSettings(this.plugin.settings, this.app.vault.adapter as FileSystemAdapter);
		this.transactionEditor = new TransactionEditor({
			target: this.contentEl,
			props: {
				transaction: this.existingTransaction,
				fromAccountOptions: accounts.sort((a, b) => {
					return (this.plugin.settings.fromAccountLastUses[b] ?? 0) - (this.plugin.settings.fromAccountLastUses[a] ?? 0)
				}),
				toAccountOptions: accounts.sort((a, b) => {
					return (this.plugin.settings.toAccountLastUses[b] ?? 0) - (this.plugin.settings.toAccountLastUses[a] ?? 0)
				}),
				saveCallback: async (t: Transaction) => {
					t.fromParts.forEach((p: TransactionPart) => {
						this.plugin.settings.fromAccountLastUses[p.account] = (new Date()).getTime();
					});
					t.toParts.forEach((p: TransactionPart) => {
						this.plugin.settings.toAccountLastUses[p.account] = (new Date()).getTime();
					});
					await this.plugin.saveSettings();
					this.finishedCallback(t);
					this.close();
				},
			}
		});
	}

	onClose() {
		if (this.transactionEditor) {
			this.transactionEditor.$destroy();
		}
	}
}

class BeancountTransactionsRecorderSettingsTab extends PluginSettingTab {
	plugin: BeancountTransactionsRecorderPlugin;

	constructor(app: App, plugin: BeancountTransactionsRecorderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Transaction save path')
			.setDesc('Path of the file to which transactions will be saved. {YYYY}, {MM}, {DD} will be replaced by year, month, day. Other text is left alone.')
			.addText(text => text
				.setPlaceholder('Path for saving transactions')
				.setValue(this.plugin.settings.saveFilePattern)
				.onChange(async (value) => {
					this.plugin.settings.saveFilePattern = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Currency symbol')
			.setDesc('Currency symbol to use (takes effect after reloading plugin, available symbols restricted by Obsidian icon set)')
			.addDropdown(dropdown => dropdown
				.addOptions({ 'euro': 'Euro', 'dollar-sign': 'Dollar' })
				.setValue(this.plugin.settings.currencyIcon)
				.onChange(async (value: string) => {
					if (isCurrencyIcon(value)) {
						this.plugin.settings.currencyIcon = value;
						await this.plugin.saveSettings();
					}
				}));
		new Setting(containerEl)
			.setName('Currency')
			.setDesc('Currency to use')
			.addText(text => text
				.setValue(this.plugin.settings.currencyIsoCode)
				.onChange(async (value: string) => {
					this.plugin.settings.currencyIsoCode = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Beancounts file for accounts')
			.setDesc('Path to the Beancount file that contains the "open" statements for the accounts you want to be able to use.')
			.addTextArea(ta => ta
				.setValue(this.plugin.settings.beancountFileForAccounts)
				.onChange(async (value: string) => {
					this.plugin.settings.beancountFileForAccounts = value;
					await this.plugin.saveSettings();
				}));
	}
}
