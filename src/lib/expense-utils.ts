
export interface Expense {
    id: string;
    description: string;
    amount: number;
    paid_by: string;
    date: string;
    category: string;
    family_id: string;
    created_at: string;
}

export interface ExpenseSplit {
    id: string;
    expense_id: string;
    profile_id: string;
    amount: number;
    percentage?: number;
}

export interface Settlement {
    id: string;
    payer_id: string;
    receiver_id: string;
    amount: number;
    date: string;
    family_id: string;
}

export interface Balance {
    profile_id: string;
    amount: number; // Positive = you paid more (others owe you), Negative = you owe others
}

export const calculateBalances = (
    expenses: { id: string; paid_by: string; amount: number }[],
    splits: ExpenseSplit[],
    settlements: Settlement[]
): Balance[] => {
    const balances: Record<string, number> = {};

    // 1. Process Expenses
    expenses.forEach((expense) => {
        // Payer gets positive balance (they paid, so they are owed this amount initially)
        balances[expense.paid_by] = (balances[expense.paid_by] || 0) + Number(expense.amount);

        // Splitters get negative balance (they consumed this share, so they owe it)
        const expenseSplits = splits.filter((s) => s.expense_id === expense.id);
        expenseSplits.forEach((split) => {
            balances[split.profile_id] = (balances[split.profile_id] || 0) - Number(split.amount);
        });
    });

    // 2. Process Settlements
    settlements.forEach((settlement) => {
        // Payer sent money, so their balance increases (debt reduced)
        balances[settlement.payer_id] = (balances[settlement.payer_id] || 0) + Number(settlement.amount);

        // Receiver got money, so their balance decreases (credit reduced)
        balances[settlement.receiver_id] = (balances[settlement.receiver_id] || 0) - Number(settlement.amount);
    });

    return Object.entries(balances).map(([profile_id, amount]) => ({
        profile_id,
        amount,
    }));
};

export const formatCurrency = (amount: number, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};
