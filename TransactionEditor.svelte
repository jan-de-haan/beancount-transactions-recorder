<script lang="ts">
	import { Plus, Trash } from "lucide-svelte";
	import Svelecte from "svelecte";
	import { Notice } from "obsidian";
	import { Transaction, TransactionPart, renderTransaction } from "Transaction";

	export let transaction: Transaction;

	export let fromAccountOptions: string[] = [];
	export let toAccountOptions: string[] = [];
	export let saveCallback: (t: Transaction) => Promise<void>;

	let saveEnabled = false;

	function addFromPart() {
		transaction.fromParts = [
			...transaction.fromParts,
			{
				id:
					transaction.fromParts
						.map((o) => o.id)
						.reduce((prev, cur) => (prev < cur ? cur : prev), 0) +
					1,
				account: "",
				amount: 0,
			},
		];
	}

	function addToPart() {
		transaction.toParts = [
			...transaction.toParts,
			{
				id:
					transaction.toParts
						.map((o) => o.id)
						.reduce((prev, cur) => (prev < cur ? cur : prev), 0) +
					1,
				account: "",
				amount: 0,
			},
		];
	}

	function removeFromPart(id: number) {
		let toRemove = transaction.fromParts.filter((o) => o.id == id)[0];
		transaction.fromParts.remove(toRemove);
		transaction.fromParts = transaction.fromParts;
	}

	function removeToPart(id: number) {
		let toRemove = transaction.toParts.filter((o) => o.id == id)[0];
		transaction.toParts.remove(toRemove);
		transaction.toParts = transaction.toParts;
	}

	function balanceFromSide() {
		let totalTo = transaction.toParts
			.map((o) => o.amount ?? 0)
			.reduce((a, b) => a + b, 0);
		let totalFrom = transaction.fromParts
			.map((o) => o.amount ?? 0)
			.reduce((a, b) => a + b, 0);
		let missingFrom = transaction.fromParts.filter((o) => (o.amount ?? 0) === 0);
		if (totalTo === totalFrom) {
			new Notice("Transaction already balanced", 1500);
		} else if (missingFrom.length == 1) {
			missingFrom[0].amount = totalTo - totalFrom;
			transaction.fromParts = transaction.fromParts;
		} else {
			new Notice("Cannot balance transaction", 1500);
		}
	}

	function balanceToSide() {
		let totalTo = transaction.toParts
			.map((o) => o.amount ?? 0)
			.reduce((a, b) => a + b, 0);
		let totalFrom = transaction.fromParts
			.map((o) => o.amount ?? 0)
			.reduce((a, b) => a + b, 0);
		let missingTo = transaction.toParts.filter((o) => (o.amount ?? 0) === 0);
		if (totalTo === totalFrom) {
			new Notice("Transaction already balanced", 1500);
		} else if (missingTo.length == 1) {
			missingTo[0].amount = totalFrom - totalTo;
			transaction.toParts = transaction.toParts;
		} else {
			new Notice("Cannot balance transaction", 1500);
		}
	}

	async function saveTransaction() {
		await saveCallback(transaction)
	}

	function validate() {
		let totalTo = transaction.toParts
			.map((o) => o.amount)
			.reduce((a, b) => a + b, 0);
		let totalFrom = transaction.fromParts
			.map((o) => o.amount)
			.reduce((a, b) => a + b, 0);

		saveEnabled = transaction.dateIsoStr.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) !== null
			&& transaction.fromParts.length > 0
			&& transaction.toParts.length > 0
			&& totalTo === totalFrom
			&& transaction.fromParts.map(p => p.account !== null).reduce((a, b) => a && b, true)
			&& transaction.toParts.map(p => p.account !== null).reduce((a, b) => a && b, true);
	}

	$: transaction, validate()
</script>

<div class="transaction-editor">
	<div class="form-block">
		<label for="dateInput">Date</label>
		<input
			id="dateInput"
			type="text"
			placeholder="YYYY-MM-DD"
			bind:value={transaction.dateIsoStr}
		/>
	</div>
	<div class="form-block">
		<label for="otherPartyNameInput">Other party</label>
		<input
			type="text"
			id="otherPartyNameInput"
			bind:value={transaction.otherPartyName}
		/>
	</div>
	<div class="form-block">
		<label for="descriptionInput">Description</label>
		<input
			type="text"
			id="descriptionInput"
			bind:value={transaction.description}
		/>
	</div>
	<label for="fromAccountInput"
		>Book from <button on:click={balanceFromSide}>Balance</button></label
	>
	<fieldset id="fromAccountInput" class="form-block">
		{#each transaction.fromParts as part (part.id)}
			<div class="transaction-row">
				<div class="account">
					<Svelecte
						options={fromAccountOptions}
						creatable={true}
						creatablePrefix={''}
						createFilter={input => { return input.contains(' ')}}
						bind:value={part.account}
					></Svelecte>
				</div>
				<input
					class="amount"
					type="number"
					step="0.01"
					min="0"
					bind:value={part.amount}
				/>
				<div class="currency">EUR</div>
				<button class="delete" on:click={() => removeFromPart(part.id)}
					><Trash size="16" /></button
				>
			</div>
		{/each}
		<button on:click={addFromPart}><Plus size="16" /></button>
	</fieldset>

	<label for="toAccountInput"
		>Book to <button on:click={balanceToSide}>Balance</button></label
	>
	<fieldset id="toAccountInput" class="form-block">
		{#each transaction.toParts as part (part.id)}
			<div class="transaction-row">
				<div class="account">
					<Svelecte
						options={toAccountOptions}
						creatable={true}
						creatablePrefix={''}
						createFilter={input => { return input.contains(' ')}}
						bind:value={part.account}
					></Svelecte>
				</div>
				<input
					class="amount"
					type="number"
					step="0.01"
					min="0"
					bind:value={part.amount}
				/>
				<div class="currency">EUR</div>
				<button class="delete" on:click={() => removeToPart(part.id)}
					><Trash size="16" /></button
				>
			</div>
		{/each}
		<button on:click={addToPart}><Plus size="16" /></button>
	</fieldset>

	<button on:click={saveTransaction} disabled={!saveEnabled}>Save Transaction</button>
</div>

<style>
	.transaction-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		margin-bottom: 1ex;
	}

	.transaction-row .account {
		flex-grow: 1;
	}

	:global(.transaction-row .account input[type="text"]) {
		outline: none;
		border: none;
		box-shadow: none;
	}

	.transaction-row .amount {
		width: 6em;
		margin-left: 1em;
		flex-grow: 0;
	}

	.transaction-row .currency {
		flex-grow: 0;
		margin-left: 0.5em;
	}

	.transaction-row .delete {
		flex-grow: 0;
		margin-left: 2em;
	}

	fieldset {
		border: none;
	}

	.form-block {
		margin-bottom: 2ex;
	}

	input[type="text"] {
		width: 100%;
	}
</style>
