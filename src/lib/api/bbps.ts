export interface BillerInfo {
    biller_id: string;
    biller_name: string;
    biller_category: string;
}

export interface MockBillResponse {
    bill_id: string;
    amount: number;
    due_date: string;
    consumer_name: string;
    status: 'GENERATED' | 'PAID';
}

// Mocked List of Billers (would normally come from BBPS /biller API)
export const MOCK_BILLERS: BillerInfo[] = [
    { biller_id: 'KSEB001', biller_name: 'Kerala State Electricity Board (KSEB)', biller_category: 'Electricity' },
    { biller_id: 'BESC001', biller_name: 'BESCOM - Bengaluru', biller_category: 'Electricity' },
    { biller_id: 'ADAN001', biller_name: 'Adani Electricity Mumbai Limited', biller_category: 'Electricity' },
    { biller_id: 'BWSS001', biller_name: 'BWSSB (Water)', biller_category: 'Water' },
    { biller_id: 'JIO001', biller_name: 'Jio Postpaid', biller_category: 'Mobile Postpaid' },
    { biller_id: 'AIRT001', biller_name: 'Airtel Broadband', biller_category: 'Broadband' },
];

/**
 * Mocks fetching a bill from a BBPS aggregator.
 * In production, this would call Setu/Razorpay with the BillerId and Consumer Number.
 */
export const fetchMockBillFromBBPS = async (billerId: string, consumerNumber: string): Promise<MockBillResponse | null> => {
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!consumerNumber || consumerNumber.length < 3) {
        throw new Error("Invalid consumer number");
    }

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);

    const hash = consumerNumber.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const amount = (hash % 2000) + 100;

    return {
        bill_id: `BBPS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        amount: amount,
        due_date: dueDate.toISOString().split('T')[0],
        consumer_name: 'Customer ' + consumerNumber.substring(0, 4),
        status: 'GENERATED'
    };
};

export interface Quote {
    provider_name: string;
    premium: number;
    coverage: number;
    features: string[];
}

export interface InsuranceMember {
    id: string;
    name: string;
    age: number;
}

/**
 * Indian Health Insurance Grouping Rules (researched, 2024):
 *
 * FAMILY FLOATER (can always be combined):
 *   - Husband + Wife: ALWAYS clubbable, no age restriction on each other
 *   - Dependent children (role='child') aged < 25: can join parents' floater
 *   - Parents/in-laws (role='parent') aged < 65: can be on same floater
 *
 * MUST SEPARATE:
 *   - Children (role='child') aged >= 25: need their own individual plan
 *
 * RECOMMENDED SEPARATE (soft advisory only — still legal to keep in floater):
 *   - Members aged 60+: Senior Citizen plans give better coverage for older people.
 *     BUT husband/wife who are 60+ CAN legally stay on a family floater.
 *     The premium is priced on the eldest member in the floater.
 */
export const groupMembersForInsurance = (
    members: InsuranceMember[],
    memberRoles: Record<string, 'parent' | 'child' | 'member'>
): {
    floater: InsuranceMember[];
    individuals: InsuranceMember[];   // adult children 25+ who MUST be on separate plans
    seniors: InsuranceMember[];       // 60+ recommended separate (not legally required)
    seniorWarning: boolean;
} => {
    const floater: InsuranceMember[] = [];
    const individuals: InsuranceMember[] = [];
    const seniors: InsuranceMember[] = [];
    let seniorWarning = false;

    for (const m of members) {
        const role = memberRoles[m.id] ?? 'parent';

        if (role === 'child' && m.age >= 25) {
            // Adult independent children must have separate plan (hard rule)
            individuals.push(m);
        } else if (m.age >= 60) {
            // 60+ — recommend separate senior plan for better coverage
            // (but husband/wife legally can stay together — we show a soft advisory)
            seniors.push(m);
            seniorWarning = true;
        } else {
            // Husband, wife, dependent parents (<60), children <25 → family floater
            floater.push(m);
        }
    }

    return { floater, individuals, seniors, seniorWarning };
};

/**
 * Mocks an Insurance Aggregator API (like PolicyBazaar/Turtlemint B2B API)
 * Now supports age-weighted premiums:
 * - Base premium adjusted per member's age
 * - Higher age → higher premium
 */
export const fetchMockInsuranceQuotes = async (
    type: string,
    targetValue: number,
    memberAges?: number[]  // Optional: list of ages for age-weighted quote
): Promise<Quote[]> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Calculate age loading factor: each year above 25 adds ~1.5% to premium
    const avgAge = memberAges && memberAges.length > 0
        ? memberAges.reduce((a, b) => a + b, 0) / memberAges.length
        : 30;
    const ageLoadFactor = Math.max(1, 1 + ((avgAge - 25) * 0.015));
    const memberCountFactor = memberAges ? Math.max(1, 1 + (memberAges.length - 1) * 0.2) : 1;

    if (type === 'health') {
        const base = Math.round(10000 * ageLoadFactor * memberCountFactor);
        return [
            {
                provider_name: 'Star Health',
                premium: Math.round(base * 1.15),
                coverage: 500000,
                features: ['Cashless', 'No Room Rent Capping', 'Free Annual Health Checkup']
            },
            {
                provider_name: 'HDFC Ergo',
                premium: Math.round(base * 1.40),
                coverage: 500000,
                features: ['Cashless', 'Global Cover', 'Restore Benefit']
            },
            {
                provider_name: 'Care Health',
                premium: Math.round(base * 1.05),
                coverage: 500000,
                features: ['Ayush Cover', 'Annual Health Checkup', 'No Co-Payment']
            },
        ];
    }

    if (type === 'life') {
        const base = Math.round(6000 * ageLoadFactor);
        return [
            { provider_name: 'LIC Term Plan', premium: Math.round(base * 1.0), coverage: 5000000, features: ['Death Benefit', 'Accidental Cover'] },
            { provider_name: 'HDFC Life Click2Protect', premium: Math.round(base * 1.15), coverage: 5000000, features: ['Critical Illness Option', 'Return of Premium'] },
            { provider_name: 'Max Life Smart Secure', premium: Math.round(base * 0.9), coverage: 5000000, features: ['Waiver of Premium', 'Terminal Illness Benefit'] },
        ];
    }

    if (type === 'vehicle') {
        const basePremium = Math.max(2000, targetValue * 0.03);
        return [
            { provider_name: 'Acko General', premium: Math.round(basePremium * 0.9), coverage: targetValue, features: ['Zero Dep', 'Doorstep Pickup'] },
            { provider_name: 'ICICI Lombard', premium: Math.round(basePremium * 1.1), coverage: targetValue, features: ['Zero Dep', 'Engine Protect'] },
            { provider_name: 'Digit Insurance', premium: Math.round(basePremium * 0.95), coverage: targetValue, features: ['Zero Dep', '24x7 Roadside'] },
        ];
    }

    if (type === 'medical') {
        const base = Math.round(5000 * ageLoadFactor);
        return [
            { provider_name: 'Niva Bupa', premium: Math.round(base * 1.0), coverage: 300000, features: ['OPD Cover', 'Teleconsultation'] },
            { provider_name: 'Aditya Birla Health', premium: Math.round(base * 1.1), coverage: 300000, features: ['Wellness Rewards', 'Daycare Procedures'] },
            { provider_name: 'ManipalCigna', premium: Math.round(base * 0.95), coverage: 300000, features: ['No Sub-Limits', 'Cashless'] },
        ];
    }

    // Default mock
    return [
        { provider_name: 'Generic Insurance Co.', premium: 5000, coverage: 200000, features: ['Standard Cover'] }
    ];
};
