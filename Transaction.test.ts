import { Transaction, parseTransaction, renderTransaction } from './Transaction';


test("transactions are rendered correctly", () => {
    let t: Transaction = {
        date: new Date("2024-01-01"),
        description: "Test",
        otherPartyName: "Blub",
        fromParts: [
            {
                id: 0,
                account: "A:B:C",
                amount: 1.25
            }
        ],
        toParts: [
            {
                id: 0,
                account: "D:E",
                amount: 1.25
            }
        ]
    }
    expect(renderTransaction(t)).toBe(`2024-01-01 * "Blub" "Test"\n` +
        `  A:B:C -1.25 EUR\n` +
        `  D:E 1.25 EUR\n`);
});


test("transactions are parsed correctly", () => {
    let t: Transaction = {
        date: new Date("2024-01-01"),
        description: "Test",
        otherPartyName: "Blub",
        fromParts: [
            {
                id: 0,
                account: "A:B:C",
                amount: 1.25
            }
        ],
        toParts: [
            {
                id: 1,
                account: "D:E",
                amount: 1.25
            }
        ]
    }
    let s = `2024-01-01 * "Blub" "Test"\n` +
    `  A:B:C -1.25 EUR\n` +
    `  D:E 1.25 EUR\n`;
    expect(parseTransaction(s)).toStrictEqual(t);
})
