export interface TransactionPart {
    id: number;
    account: string;
    amount: number
}

export interface Transaction {
    dateIsoStr: string;
    otherPartyName: string;
    description: string;
    fromParts: TransactionPart[];
    toParts: TransactionPart[];
}

export function renderTransaction(t: Transaction): string {
    let result = `${t.dateIsoStr} * "${t.otherPartyName}" "${t.description}"\n`;
    t.fromParts.forEach(part => {
        result += `  ${part.account} -${part.amount.toFixed(2)} EUR\n`
    });
    t.toParts.forEach(part => {
        result += `  ${part.account} ${part.amount.toFixed(2)} EUR\n`
    });
    return result;
}

export function parseTransaction(s: string): Transaction | null {
    let lines = s.split("\n");
    let match = lines[0].match(/([0-9]{4}-[0-9]{1,2}-[0-9]{1,2}) [*?] "(.*)" "(.*)"/);
    if (match === null) {
        return null;
    }
    
    let dateIsoStr = match[1];
    let otherPartyName = match[2];
    let description = match[3];
    
    let idCounter = 0;
    let toParts: TransactionPart[] = [];
    let fromParts: TransactionPart[] = [];
    lines.slice(1).forEach(line => {
        if (line.length == 0) {
            return;
        }
        let match = line.match(/  (.*) ([0-9.\-]*) EUR/);
        if (match) {
            let account = match[1];
            let amount = parseFloat(match[2]);
            if(amount < 0) {
                fromParts.push({id: idCounter, account: account, amount: -amount});
            } else {
                toParts.push({id: idCounter, account: account, amount: amount});
            }
            idCounter += 1;
        }
    })

    return {
        dateIsoStr: dateIsoStr,
        otherPartyName: otherPartyName,
        description: description,
        fromParts: fromParts,
        toParts: toParts
    }
}