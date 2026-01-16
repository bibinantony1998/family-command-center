export interface Balance {
    profile_id: string;
    amount: number;
}

export interface ExpenseSplit {
    id: string;
    expense_id: string;
    profile_id: string;
    amount: number;
}

export interface Settlement {
    id: string;
    payer_id: string;
    receiver_id: string;
    amount: number;
    date: string;
    family_id: string;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
}

export function calculateBalances(
    expenses: any[],
    splits: any[],
    settlements: any[]
): Balance[] {
    const balances: Record<string, number> = {};

    // Initialize balances for all involved users
    expenses.forEach((e) => {
        if (!balances[e.paid_by]) balances[e.paid_by] = 0;
    });
    splits.forEach((s) => {
        if (!balances[s.profile_id]) balances[s.profile_id] = 0;
    });
    settlements.forEach((s) => {
        if (!balances[s.payer_id]) balances[s.payer_id] = 0;
        if (!balances[s.receiver_id]) balances[s.receiver_id] = 0;
    });

    // 1. Process Expenses & Splits
    expenses.forEach((expense) => {
        const expenseSplits = splits.filter((s) => s.expense_id === expense.id);

        if (expenseSplits.length === 0) {
            // Default: Split equally among all (simple case) but strictly we rely on splits table
        } else {
            expenseSplits.forEach((split) => {
                // The payer GAINS the amount they paid for others (conceptually)
                // BUT simpler model:
                // Payer +Total Amount
                // Splitter -Split Amount

                // Actually, let's track "Net Balance": + means you are OWED, - means you OWE.

                if (expense.paid_by === split.profile_id) {
                    // If I paid for myself, no net change relative to group debt, 
                    // BUT logic usually is: I paid $100. My share is $50. I am owed $50.
                    // Implementation:
                    // Payer gets +FullAmount
                    // Everyone gets -TheirShare
                    // Net = +100 -50 = +50 (Owed)
                }
            });

            // Correct Algorithm:
            // Payer: +Amount
            // Each Splitter: -SplitAmount

            balances[expense.paid_by] += expense.amount;
            expenseSplits.forEach((split) => {
                balances[split.profile_id] -= split.amount;
            });
        }
    });

    // 2. Process Settlements
    settlements.forEach((settlement) => {
        // Payer gives money to Receiver.
        // Payer's debt decreases (becomes more positive / less negative) -> +Amount
        // Receiver's credit decreases (becomes less positive) -> -Amount

        // Wait, if I OWE (-50) and I PAY (50). My balance should go to 0. (+50).
        // If I am OWED (50) and Get Paid (50). My balance should go to 0. (-50).
        // Correct.

        balances[settlement.payer_id] += settlement.amount;
        balances[settlement.receiver_id] -= settlement.amount;
    });

    return Object.entries(balances).map(([profile_id, amount]) => ({
        profile_id,
        amount,
    }));
}
