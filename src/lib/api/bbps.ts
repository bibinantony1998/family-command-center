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

// Comprehensive Indian BBPS Biller List — sourced from public DISCOM / BBPS data (2024)
// Categories: Electricity, Gas, Water, Broadband, Mobile Postpaid, DTH
export const MOCK_BILLERS: BillerInfo[] = [
    // ───── ELECTRICITY — Andhra Pradesh ─────
    { biller_id: 'APEPDCL', biller_name: 'APEPDCL (AP Eastern)', biller_category: 'Electricity' },
    { biller_id: 'APCPDCL', biller_name: 'APCPDCL (AP Central)', biller_category: 'Electricity' },
    { biller_id: 'APSPDCL', biller_name: 'APSPDCL (AP Southern)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Assam ─────
    { biller_id: 'APDCL', biller_name: 'APDCL (Assam)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Bihar ─────
    { biller_id: 'NBPDCL', biller_name: 'NBPDCL (North Bihar)', biller_category: 'Electricity' },
    { biller_id: 'SBPDCL', biller_name: 'SBPDCL (South Bihar)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Chhattisgarh ─────
    { biller_id: 'CSPDCL', biller_name: 'CSPDCL (Chhattisgarh)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Delhi ─────
    { biller_id: 'TPDDL', biller_name: 'Tata Power Delhi (TPDDL)', biller_category: 'Electricity' },
    { biller_id: 'BRPL', biller_name: 'BSES Rajdhani (BRPL)', biller_category: 'Electricity' },
    { biller_id: 'BYPL', biller_name: 'BSES Yamuna (BYPL)', biller_category: 'Electricity' },
    { biller_id: 'NDMC_E', biller_name: 'NDMC Electricity (Delhi)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Gujarat ─────
    { biller_id: 'DGVCL', biller_name: 'DGVCL (Dakshin Gujarat Vij)', biller_category: 'Electricity' },
    { biller_id: 'MGVCL', biller_name: 'MGVCL (Madhya Gujarat Vij)', biller_category: 'Electricity' },
    { biller_id: 'PGVCL', biller_name: 'PGVCL (Paschim Gujarat Vij)', biller_category: 'Electricity' },
    { biller_id: 'UGVCL', biller_name: 'UGVCL (Uttar Gujarat Vij)', biller_category: 'Electricity' },
    { biller_id: 'TORRENT_AHMD', biller_name: 'Torrent Power Ahmedabad', biller_category: 'Electricity' },
    { biller_id: 'TORRENT_SURAT', biller_name: 'Torrent Power Surat', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Haryana ─────
    { biller_id: 'DHBVNL', biller_name: 'DHBVNL (Dakshin Haryana)', biller_category: 'Electricity' },
    { biller_id: 'UHBVNL', biller_name: 'UHBVNL (Uttar Haryana)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Himachal Pradesh ─────
    { biller_id: 'HPSEBL', biller_name: 'HPSEBL (Himachal Pradesh)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Jharkhand ─────
    { biller_id: 'JBVNL', biller_name: 'JBVNL (Jharkhand)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Karnataka ─────
    { biller_id: 'BESCOM', biller_name: 'BESCOM (Bangalore)', biller_category: 'Electricity' },
    { biller_id: 'MESCOM', biller_name: 'MESCOM (Mangalore)', biller_category: 'Electricity' },
    { biller_id: 'HESCOM', biller_name: 'HESCOM (Hubli)', biller_category: 'Electricity' },
    { biller_id: 'GESCOM', biller_name: 'GESCOM (Gulbarga)', biller_category: 'Electricity' },
    { biller_id: 'CESCL', biller_name: 'CESC (Mysuru)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Kerala ─────
    { biller_id: 'KSEBL', biller_name: 'KSEBL (Kerala)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Madhya Pradesh ─────
    { biller_id: 'MPPKVVCL', biller_name: 'MP Poorv Kshetra (MPPKVVCL)', biller_category: 'Electricity' },
    { biller_id: 'MPMKVVCL', biller_name: 'MP Madhya Kshetra (MPMKVVCL)', biller_category: 'Electricity' },
    { biller_id: 'MPPMKVVCL', biller_name: 'MP Paschim Kshetra (MPPMKVVCL)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Maharashtra ─────
    { biller_id: 'MSEDCL', biller_name: 'MSEDCL (Maharashtra)', biller_category: 'Electricity' },
    { biller_id: 'ADANI_MUM', biller_name: 'Adani Electricity Mumbai', biller_category: 'Electricity' },
    { biller_id: 'BEST', biller_name: 'BEST (Mumbai)', biller_category: 'Electricity' },
    { biller_id: 'TATA_MUM', biller_name: 'Tata Power Mumbai', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Odisha ─────
    { biller_id: 'TPCODL', biller_name: 'TP Central Odisha (TPCODL)', biller_category: 'Electricity' },
    { biller_id: 'TPNODL', biller_name: 'TP Northern Odisha (TPNODL)', biller_category: 'Electricity' },
    { biller_id: 'TPSODL', biller_name: 'TP Southern Odisha (TPSODL)', biller_category: 'Electricity' },
    { biller_id: 'TPWODL', biller_name: 'TP Western Odisha (TPWODL)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Punjab ─────
    { biller_id: 'PSPCL', biller_name: 'PSPCL (Punjab)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Rajasthan ─────
    { biller_id: 'JVVNL', biller_name: 'JVVNL (Jaipur)', biller_category: 'Electricity' },
    { biller_id: 'AVVNL', biller_name: 'AVVNL (Ajmer)', biller_category: 'Electricity' },
    { biller_id: 'JDVVNL', biller_name: 'JdVVNL (Jodhpur)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Tamil Nadu ─────
    { biller_id: 'TANGEDCO', biller_name: 'TANGEDCO (Tamil Nadu)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Telangana ─────
    { biller_id: 'TSNPDCL', biller_name: 'TSNPDCL (North Telangana)', biller_category: 'Electricity' },
    { biller_id: 'TSSPDCL', biller_name: 'TSSPDCL (South Telangana)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Uttar Pradesh ─────
    { biller_id: 'UPPCL', biller_name: 'UPPCL (Uttar Pradesh)', biller_category: 'Electricity' },
    { biller_id: 'PUVVNL', biller_name: 'PuVVNL (Poorvanchal UP)', biller_category: 'Electricity' },
    { biller_id: 'PVVNL', biller_name: 'PVVNL (Paschimanchal UP)', biller_category: 'Electricity' },
    { biller_id: 'MVVNL', biller_name: 'MVVNL (Madhyanchal UP)', biller_category: 'Electricity' },
    { biller_id: 'DVVNL', biller_name: 'DVVNL (Dakshinanchal UP)', biller_category: 'Electricity' },
    { biller_id: 'NPCL', biller_name: 'NPCL (Noida Power)', biller_category: 'Electricity' },
    { biller_id: 'KESCO', biller_name: 'KESCO (Kanpur)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Uttarakhand ─────
    { biller_id: 'UPCL', biller_name: 'UPCL (Uttarakhand)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — West Bengal ─────
    { biller_id: 'WBSEDCL', biller_name: 'WBSEDCL (West Bengal)', biller_category: 'Electricity' },
    { biller_id: 'CESC_KOL', biller_name: 'CESC Limited (Kolkata)', biller_category: 'Electricity' },
    // ───── ELECTRICITY — Goa ─────
    { biller_id: 'GOA_ELEC', biller_name: 'Electricity Dept. Goa', biller_category: 'Electricity' },
    // ───── ELECTRICITY — J&K ─────
    { biller_id: 'JKPDD', biller_name: 'JKPDD (Jammu & Kashmir)', biller_category: 'Electricity' },

    // ───── GAS — LPG Providers ─────
    { biller_id: 'HPGAS', biller_name: 'HP Gas (HPCL)', biller_category: 'Gas' },
    { biller_id: 'BHARATGAS', biller_name: 'Bharat Gas (BPCL)', biller_category: 'Gas' },
    { biller_id: 'INDANE', biller_name: 'Indane Gas (IOCL)', biller_category: 'Gas' },
    // ───── GAS — PNG / City Gas ─────
    { biller_id: 'IGL', biller_name: 'IGL (Indraprastha Gas) — Delhi NCR', biller_category: 'Gas' },
    { biller_id: 'MGL', biller_name: 'MGL (Mahanagar Gas) — Mumbai', biller_category: 'Gas' },
    { biller_id: 'GAIL_GAS', biller_name: 'GAIL Gas Limited', biller_category: 'Gas' },
    { biller_id: 'GGL', biller_name: 'Gujarat Gas Limited (GGL)', biller_category: 'Gas' },
    { biller_id: 'ADANI_TOTAL_GAS', biller_name: 'Adani Total Gas Limited', biller_category: 'Gas' },
    { biller_id: 'TORRENT_GAS', biller_name: 'Torrent Gas', biller_category: 'Gas' },
    { biller_id: 'THINK_GAS', biller_name: 'Think Gas', biller_category: 'Gas' },
    { biller_id: 'MNGL', biller_name: 'MNGL (Maharashtra Natural Gas) — Pune', biller_category: 'Gas' },
    { biller_id: 'SABARMATI_GAS', biller_name: 'Sabarmati Gas (North Gujarat)', biller_category: 'Gas' },
    { biller_id: 'AAVANTIKA_GAS', biller_name: 'Aavantika Gas (Indore/Ujjain)', biller_category: 'Gas' },
    { biller_id: 'BGASL', biller_name: 'Bhagyanagar Gas (AP/Telangana)', biller_category: 'Gas' },
    { biller_id: 'GREEN_GAS', biller_name: 'Green Gas Limited (Lucknow)', biller_category: 'Gas' },
    { biller_id: 'AGCL', biller_name: 'Assam Gas Company (AGCL)', biller_category: 'Gas' },

    // ───── WATER ─────
    { biller_id: 'BWSSB', biller_name: 'BWSSB (Bangalore Water)', biller_category: 'Water' },
    { biller_id: 'MCGM_WATER', biller_name: 'MCGM Water (Mumbai)', biller_category: 'Water' },
    { biller_id: 'DJB', biller_name: 'Delhi Jal Board (DJB)', biller_category: 'Water' },
    { biller_id: 'CMWSSB', biller_name: 'CMWSSB (Chennai Metro Water)', biller_category: 'Water' },
    { biller_id: 'HMWS_SB', biller_name: 'HMWS&SB (Hyderabad Metro Water)', biller_category: 'Water' },
    { biller_id: 'PHED_RAJ', biller_name: 'PHED Rajasthan (Water)', biller_category: 'Water' },
    { biller_id: 'PUNE_WATER', biller_name: 'PMC (Pune Municipal Water)', biller_category: 'Water' },
    { biller_id: 'KWA', biller_name: 'Kerala Water Authority (KWA)', biller_category: 'Water' },

    // ───── BROADBAND / INTERNET ─────
    { biller_id: 'AIRTEL_BB', biller_name: 'Airtel Broadband', biller_category: 'Broadband' },
    { biller_id: 'JIO_FIBER', biller_name: 'Jio Fiber', biller_category: 'Broadband' },
    { biller_id: 'BSNL_BB', biller_name: 'BSNL Broadband', biller_category: 'Broadband' },
    { biller_id: 'ACT_BB', biller_name: 'ACT Fibernet', biller_category: 'Broadband' },
    { biller_id: 'HATHWAY', biller_name: 'Hathway Broadband', biller_category: 'Broadband' },
    { biller_id: 'TATA_PLAY_BB', biller_name: 'Tata Play Broadband', biller_category: 'Broadband' },
    { biller_id: 'YOU_BB', biller_name: 'YOU Broadband', biller_category: 'Broadband' },
    { biller_id: 'ASIANET_BB', biller_name: 'Asianet Broadband (Kerala)', biller_category: 'Broadband' },
    { biller_id: 'DEN_BB', biller_name: 'DEN Networks', biller_category: 'Broadband' },

    // ───── MOBILE POSTPAID ─────
    { biller_id: 'AIRTEL_POST', biller_name: 'Airtel Postpaid', biller_category: 'Mobile Postpaid' },
    { biller_id: 'JIO_POST', biller_name: 'Jio Postpaid', biller_category: 'Mobile Postpaid' },
    { biller_id: 'VI_POST', biller_name: 'Vi (Vodafone Idea) Postpaid', biller_category: 'Mobile Postpaid' },
    { biller_id: 'BSNL_POST', biller_name: 'BSNL Mobile Postpaid', biller_category: 'Mobile Postpaid' },
    { biller_id: 'MTNL_POST', biller_name: 'MTNL Postpaid (Mumbai/Delhi)', biller_category: 'Mobile Postpaid' },

    // ───── DTH ─────
    { biller_id: 'TATA_PLAY', biller_name: 'Tata Play (DTH)', biller_category: 'DTH' },
    { biller_id: 'DISH_TV', biller_name: 'Dish TV', biller_category: 'DTH' },
    { biller_id: 'AIRTEL_DTH', biller_name: 'Airtel DTH (Xstream)', biller_category: 'DTH' },
    { biller_id: 'SUN_DTH', biller_name: 'Sun Direct DTH', biller_category: 'DTH' },
    { biller_id: 'VIDEOCON_DTH', biller_name: 'D2H (Videocon DTH)', biller_category: 'DTH' },
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
