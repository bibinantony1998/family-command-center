export interface BillerInfo {
    biller_id: string;
    biller_name: string;
    biller_category: string;
    state?: string;
}

export interface MockBillResponse {
    bill_id: string;
    amount: number;
    due_date: string;
    consumer_name: string;
    status: 'GENERATED' | 'PAID';
}

export const INDIAN_STATES = [
    'National', 'Andaman and Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 
    'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

// Comprehensive Indian BBPS Biller List — sourced from public DISCOM / BBPS data (2024)
// Categories: Electricity, Gas, Water, Broadband, Mobile Postpaid, DTH
export const MOCK_BILLERS: BillerInfo[] = [
    // ───── ELECTRICITY — Andhra Pradesh ─────
    { biller_id: 'APEPDCL', biller_name: 'APEPDCL (AP Eastern)', biller_category: 'Electricity', state: 'Andhra Pradesh' },
    { biller_id: 'APCPDCL', biller_name: 'APCPDCL (AP Central)', biller_category: 'Electricity', state: 'Andhra Pradesh' },
    { biller_id: 'APSPDCL', biller_name: 'APSPDCL (AP Southern)', biller_category: 'Electricity', state: 'Andhra Pradesh' },
    // ───── ELECTRICITY — Assam ─────
    { biller_id: 'APDCL', biller_name: 'APDCL (Assam)', biller_category: 'Electricity', state: 'Assam' },
    // ───── ELECTRICITY — Bihar ─────
    { biller_id: 'NBPDCL', biller_name: 'NBPDCL (North Bihar)', biller_category: 'Electricity', state: 'Bihar' },
    { biller_id: 'SBPDCL', biller_name: 'SBPDCL (South Bihar)', biller_category: 'Electricity', state: 'Bihar' },
    // ───── ELECTRICITY — Chhattisgarh ─────
    { biller_id: 'CSPDCL', biller_name: 'CSPDCL (Chhattisgarh)', biller_category: 'Electricity', state: 'Chhattisgarh' },
    // ───── ELECTRICITY — Delhi ─────
    { biller_id: 'TPDDL', biller_name: 'Tata Power Delhi (TPDDL)', biller_category: 'Electricity', state: 'Delhi' },
    { biller_id: 'BRPL', biller_name: 'BSES Rajdhani (BRPL)', biller_category: 'Electricity', state: 'Delhi' },
    { biller_id: 'BYPL', biller_name: 'BSES Yamuna (BYPL)', biller_category: 'Electricity', state: 'Delhi' },
    { biller_id: 'NDMC_E', biller_name: 'NDMC Electricity (Delhi)', biller_category: 'Electricity', state: 'Delhi' },
    // ───── ELECTRICITY — Gujarat ─────
    { biller_id: 'DGVCL', biller_name: 'DGVCL (Dakshin Gujarat Vij)', biller_category: 'Electricity', state: 'Gujarat' },
    { biller_id: 'MGVCL', biller_name: 'MGVCL (Madhya Gujarat Vij)', biller_category: 'Electricity', state: 'Gujarat' },
    { biller_id: 'PGVCL', biller_name: 'PGVCL (Paschim Gujarat Vij)', biller_category: 'Electricity', state: 'Gujarat' },
    { biller_id: 'UGVCL', biller_name: 'UGVCL (Uttar Gujarat Vij)', biller_category: 'Electricity', state: 'Gujarat' },
    { biller_id: 'TORRENT_AHMD', biller_name: 'Torrent Power Ahmedabad', biller_category: 'Electricity', state: 'Gujarat' },
    { biller_id: 'TORRENT_SURAT', biller_name: 'Torrent Power Surat', biller_category: 'Electricity', state: 'Gujarat' },
    { biller_id: 'GIFT_POWER', biller_name: 'Gift Power Company Limited', biller_category: 'Electricity', state: 'Gujarat' },
    // ───── ELECTRICITY — Haryana ─────
    { biller_id: 'DHBVNL', biller_name: 'DHBVNL (Dakshin Haryana)', biller_category: 'Electricity', state: 'Haryana' },
    { biller_id: 'UHBVNL', biller_name: 'UHBVNL (Uttar Haryana)', biller_category: 'Electricity', state: 'Haryana' },
    // ───── ELECTRICITY — Himachal Pradesh ─────
    { biller_id: 'HPSEBL', biller_name: 'HPSEBL (Himachal Pradesh)', biller_category: 'Electricity', state: 'Himachal Pradesh' },
    // ───── ELECTRICITY — Jharkhand ─────
    { biller_id: 'JBVNL', biller_name: 'JBVNL (Jharkhand)', biller_category: 'Electricity', state: 'Jharkhand' },
    // ───── ELECTRICITY — Karnataka ─────
    { biller_id: 'BESCOM', biller_name: 'BESCOM (Bangalore)', biller_category: 'Electricity', state: 'Karnataka' },
    { biller_id: 'MESCOM', biller_name: 'MESCOM (Mangalore)', biller_category: 'Electricity', state: 'Karnataka' },
    { biller_id: 'HESCOM', biller_name: 'HESCOM (Hubli)', biller_category: 'Electricity', state: 'Karnataka' },
    { biller_id: 'GESCOM', biller_name: 'GESCOM (Gulbarga)', biller_category: 'Electricity', state: 'Karnataka' },
    { biller_id: 'CESCL', biller_name: 'CESC (Mysuru)', biller_category: 'Electricity', state: 'Karnataka' },
    // ───── ELECTRICITY — Kerala ─────
    { biller_id: 'KSEBL', biller_name: 'KSEBL (Kerala)', biller_category: 'Electricity', state: 'Kerala' },
    { biller_id: 'TCED', biller_name: 'Thrissur Corporation Electricity Dept (TCED)', biller_category: 'Electricity', state: 'Kerala' },
    { biller_id: 'KANNUR_ELEC', biller_name: 'Kannur Electricity Board', biller_category: 'Electricity', state: 'Kerala' },
    { biller_id: 'KDHP', biller_name: 'Kannan Devan Hills Plantation (KDHP)', biller_category: 'Electricity', state: 'Kerala' },
    // ───── ELECTRICITY — Madhya Pradesh ─────
    { biller_id: 'MPPKVVCL', biller_name: 'MP Poorv Kshetra (MPPKVVCL)', biller_category: 'Electricity', state: 'Madhya Pradesh' },
    { biller_id: 'MPMKVVCL', biller_name: 'MP Madhya Kshetra (MPMKVVCL)', biller_category: 'Electricity', state: 'Madhya Pradesh' },
    { biller_id: 'MPPMKVVCL', biller_name: 'MP Paschim Kshetra (MPPMKVVCL)', biller_category: 'Electricity', state: 'Madhya Pradesh' },
    // ───── ELECTRICITY — Maharashtra ─────
    { biller_id: 'MSEDCL', biller_name: 'MSEDCL (Maharashtra)', biller_category: 'Electricity', state: 'Maharashtra' },
    { biller_id: 'ADANI_MUM', biller_name: 'Adani Electricity Mumbai', biller_category: 'Electricity', state: 'Maharashtra' },
    { biller_id: 'BEST', biller_name: 'BEST (Mumbai)', biller_category: 'Electricity', state: 'Maharashtra' },
    { biller_id: 'TATA_MUM', biller_name: 'Tata Power Mumbai', biller_category: 'Electricity', state: 'Maharashtra' },
    // ───── ELECTRICITY — Odisha ─────
    { biller_id: 'TPCODL', biller_name: 'TP Central Odisha (TPCODL)', biller_category: 'Electricity', state: 'Odisha' },
    { biller_id: 'TPNODL', biller_name: 'TP Northern Odisha (TPNODL)', biller_category: 'Electricity', state: 'Odisha' },
    { biller_id: 'TPSODL', biller_name: 'TP Southern Odisha (TPSODL)', biller_category: 'Electricity', state: 'Odisha' },
    { biller_id: 'TPWODL', biller_name: 'TP Western Odisha (TPWODL)', biller_category: 'Electricity', state: 'Odisha' },
    // ───── ELECTRICITY — Punjab ─────
    { biller_id: 'PSPCL', biller_name: 'PSPCL (Punjab)', biller_category: 'Electricity', state: 'Punjab' },
    // ───── ELECTRICITY — Rajasthan ─────
    { biller_id: 'JVVNL', biller_name: 'JVVNL (Jaipur)', biller_category: 'Electricity', state: 'Rajasthan' },
    { biller_id: 'AVVNL', biller_name: 'AVVNL (Ajmer)', biller_category: 'Electricity', state: 'Rajasthan' },
    { biller_id: 'JDVVNL', biller_name: 'JdVVNL (Jodhpur)', biller_category: 'Electricity', state: 'Rajasthan' },
    // ───── ELECTRICITY — Tamil Nadu ─────
    { biller_id: 'TANGEDCO', biller_name: 'TANGEDCO (Tamil Nadu)', biller_category: 'Electricity', state: 'Tamil Nadu' },
    // ───── ELECTRICITY — Telangana ─────
    { biller_id: 'TSNPDCL', biller_name: 'TSNPDCL (North Telangana)', biller_category: 'Electricity', state: 'Telangana' },
    { biller_id: 'TSSPDCL', biller_name: 'TSSPDCL (South Telangana)', biller_category: 'Electricity', state: 'Telangana' },
    // ───── ELECTRICITY — Uttar Pradesh ─────
    { biller_id: 'UPPCL', biller_name: 'UPPCL (Uttar Pradesh)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'PUVVNL', biller_name: 'PuVVNL (Poorvanchal UP)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'PVVNL', biller_name: 'PVVNL (Paschimanchal UP)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'MVVNL', biller_name: 'MVVNL (Madhyanchal UP)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'DVVNL', biller_name: 'DVVNL (Dakshinanchal UP)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'NPCL', biller_name: 'NPCL (Noida Power)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'KESCO', biller_name: 'KESCO (Kanpur)', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    { biller_id: 'TORRENT_AGRA', biller_name: 'Torrent Power Agra', biller_category: 'Electricity', state: 'Uttar Pradesh' },
    // ───── ELECTRICITY — Uttarakhand ─────
    { biller_id: 'UPCL', biller_name: 'UPCL (Uttarakhand)', biller_category: 'Electricity', state: 'Uttarakhand' },
    // ───── ELECTRICITY — West Bengal ─────
    { biller_id: 'WBSEDCL', biller_name: 'WBSEDCL (West Bengal)', biller_category: 'Electricity', state: 'West Bengal' },
    { biller_id: 'CESC_KOL', biller_name: 'CESC Limited (Kolkata)', biller_category: 'Electricity', state: 'West Bengal' },
    { biller_id: 'IPCL', biller_name: 'India Power Corporation Limited (IPCL)', biller_category: 'Electricity', state: 'West Bengal' },
    // ───── ELECTRICITY — Goa ─────
    { biller_id: 'GOA_ELEC', biller_name: 'Electricity Dept. Goa', biller_category: 'Electricity', state: 'Goa' },
    // ───── ELECTRICITY — J&K ─────
    { biller_id: 'JKPDD', biller_name: 'JKPDD (Jammu & Kashmir)', biller_category: 'Electricity', state: 'Jammu & Kashmir' },
    // ───── ELECTRICITY — North-East States ─────
    { biller_id: 'MePDCL', biller_name: 'MePDCL (Meghalaya)', biller_category: 'Electricity', state: 'Meghalaya' },
    { biller_id: 'TSECL', biller_name: 'TSECL (Tripura)', biller_category: 'Electricity', state: 'Tripura' },
    { biller_id: 'MSPDCL', biller_name: 'MSPDCL (Manipur)', biller_category: 'Electricity', state: 'Manipur' },
    { biller_id: 'DOP_NAGALAND', biller_name: 'Department of Power Nagaland', biller_category: 'Electricity', state: 'Nagaland' },
    { biller_id: 'DOP_ARUNACHAL', biller_name: 'Department of Power Arunachal Pradesh', biller_category: 'Electricity', state: 'Arunachal Pradesh' },
    { biller_id: 'SIKKIM_POWER', biller_name: 'Sikkim Power', biller_category: 'Electricity', state: 'Sikkim' },
    { biller_id: 'PED_MIZORAM', biller_name: 'Power & Electricity Department Mizoram', biller_category: 'Electricity', state: 'Mizoram' },
    // ───── ELECTRICITY — Union Territories ─────
    { biller_id: 'ED_CHANDIGARH', biller_name: 'Electricity Department Chandigarh', biller_category: 'Electricity', state: 'Chandigarh' },
    { biller_id: 'ED_PUDUCHERRY', biller_name: 'Electricity Department Puducherry', biller_category: 'Electricity', state: 'Puducherry' },
    { biller_id: 'DNHPDCL', biller_name: 'DNHPDCL', biller_category: 'Electricity', state: 'Dadra and Nagar Haveli and Daman and Diu' },
    { biller_id: 'ED_ANDAMAN', biller_name: 'Electricity Department Andaman and Nicobar', biller_category: 'Electricity', state: 'Andaman and Nicobar' },
    { biller_id: 'LAKSHADWEEP_ED', biller_name: 'Lakshadweep Electricity Department', biller_category: 'Electricity', state: 'Lakshadweep' },

    // ───── GAS — LPG Providers ─────
    { biller_id: 'HPGAS', biller_name: 'HP Gas (HPCL)', biller_category: 'Gas', state: 'National' },
    { biller_id: 'BHARATGAS', biller_name: 'Bharat Gas (BPCL)', biller_category: 'Gas', state: 'National' },
    { biller_id: 'INDANE', biller_name: 'Indane Gas (IOCL)', biller_category: 'Gas', state: 'National' },
    // ───── GAS — PNG / City Gas ─────
    { biller_id: 'IGL', biller_name: 'IGL (Indraprastha Gas) — Delhi NCR', biller_category: 'Gas', state: 'Delhi' },
    { biller_id: 'MGL', biller_name: 'MGL (Mahanagar Gas) — Mumbai', biller_category: 'Gas', state: 'Maharashtra' },
    { biller_id: 'GAIL_GAS', biller_name: 'GAIL Gas Limited', biller_category: 'Gas', state: 'National' },
    { biller_id: 'GGL', biller_name: 'Gujarat Gas Limited (GGL)', biller_category: 'Gas', state: 'Gujarat' },
    { biller_id: 'ADANI_TOTAL_GAS', biller_name: 'Adani Total Gas Limited', biller_category: 'Gas', state: 'Gujarat' },
    { biller_id: 'TORRENT_GAS', biller_name: 'Torrent Gas', biller_category: 'Gas', state: 'National' },
    { biller_id: 'THINK_GAS', biller_name: 'Think Gas', biller_category: 'Gas', state: 'National' },
    { biller_id: 'MNGL', biller_name: 'MNGL (Maharashtra Natural Gas) — Pune', biller_category: 'Gas', state: 'Maharashtra' },
    { biller_id: 'SABARMATI_GAS', biller_name: 'Sabarmati Gas (North Gujarat)', biller_category: 'Gas', state: 'Gujarat' },
    { biller_id: 'AAVANTIKA_GAS', biller_name: 'Aavantika Gas (Indore/Ujjain)', biller_category: 'Gas', state: 'Madhya Pradesh' },
    { biller_id: 'BGASL', biller_name: 'Bhagyanagar Gas (AP/Telangana)', biller_category: 'Gas', state: 'Telangana' },
    { biller_id: 'GREEN_GAS', biller_name: 'Green Gas Limited (Lucknow)', biller_category: 'Gas', state: 'Uttar Pradesh' },
    { biller_id: 'AGCL', biller_name: 'Assam Gas Company (AGCL)', biller_category: 'Gas', state: 'Assam' },
    { biller_id: 'BENGAL_GAS', biller_name: 'Bengal Gas Company Limited', biller_category: 'Gas', state: 'West Bengal' },
    { biller_id: 'CUGL', biller_name: 'Central U.P. Gas Limited (CUGL)', biller_category: 'Gas', state: 'Uttar Pradesh' },
    { biller_id: 'CHAROTAR_GAS', biller_name: 'Charotar Gas Sahakari Mandali Ltd', biller_category: 'Gas', state: 'Gujarat' },
    { biller_id: 'GOA_NATURAL_GAS', biller_name: 'Goa Natural Gas Private Limited', biller_category: 'Gas', state: 'Goa' },
    { biller_id: 'GODAVARI_GAS', biller_name: 'Godavari Gas Pvt Ltd', biller_category: 'Gas', state: 'Andhra Pradesh' },
    { biller_id: 'HARYANA_CITY_GAS', biller_name: 'Haryana City Gas', biller_category: 'Gas', state: 'Haryana' },
    { biller_id: 'IOAGPL', biller_name: 'Indian Oil Adani Gas Pvt. Ltd.', biller_category: 'Gas', state: 'National' },
    { biller_id: 'IOCL_PNG', biller_name: 'Indian Oil Corporation Ltd-Piped Gas', biller_category: 'Gas', state: 'National' },
    { biller_id: 'IRM_ENERGY', biller_name: 'IRM Energy Private Limited', biller_category: 'Gas', state: 'Gujarat' },
    { biller_id: 'MEGHA_GAS', biller_name: 'Megha Gas', biller_category: 'Gas', state: 'National' },
    { biller_id: 'NAVERIYA_GAS', biller_name: 'Naveriya Gas Pvt Ltd', biller_category: 'Gas', state: 'Madhya Pradesh' },
    { biller_id: 'PURBA_BHARATI_GAS', biller_name: 'Purba Bharati Gas Pvt Ltd', biller_category: 'Gas', state: 'Assam' },
    { biller_id: 'RAJASTHAN_STATE_GAS', biller_name: 'Rajasthan State Gas Limited', biller_category: 'Gas', state: 'Rajasthan' },
    { biller_id: 'SITI_ENERGY', biller_name: 'Siti Energy Limited', biller_category: 'Gas', state: 'Uttar Pradesh' },
    { biller_id: 'VGL', biller_name: 'Vadodara Gas Limited (VGL)', biller_category: 'Gas', state: 'Gujarat' },

    // ───── WATER ─────
    { biller_id: 'BWSSB', biller_name: 'BWSSB (Bangalore Water)', biller_category: 'Water', state: 'Karnataka' },
    { biller_id: 'MCGM_WATER', biller_name: 'MCGM Water (Mumbai)', biller_category: 'Water', state: 'Maharashtra' },
    { biller_id: 'DJB', biller_name: 'Delhi Jal Board (DJB)', biller_category: 'Water', state: 'Delhi' },
    { biller_id: 'CMWSSB', biller_name: 'CMWSSB (Chennai Metro Water)', biller_category: 'Water', state: 'Tamil Nadu' },
    { biller_id: 'HMWS_SB', biller_name: 'HMWS&SB (Hyderabad Metro Water)', biller_category: 'Water', state: 'Telangana' },
    { biller_id: 'PHED_RAJ', biller_name: 'PHED Rajasthan (Water)', biller_category: 'Water', state: 'Rajasthan' },
    { biller_id: 'PUNE_WATER', biller_name: 'PMC (Pune Municipal Water)', biller_category: 'Water', state: 'Maharashtra' },
    { biller_id: 'KWA', biller_name: 'Kerala Water Authority (KWA)', biller_category: 'Water', state: 'Kerala' },
    { biller_id: 'AMC_WATER', biller_name: 'Ahmedabad Municipal Corporation', biller_category: 'Water', state: 'Gujarat' },
    { biller_id: 'BMC_WATER', biller_name: 'Bhopal Municipal Corporation', biller_category: 'Water', state: 'Madhya Pradesh' },
    { biller_id: 'GWMC_WATER', biller_name: 'Greater Warangal Municipal Corporation', biller_category: 'Water', state: 'Telangana' },
    { biller_id: 'GMC_WATER', biller_name: 'Gwalior Municipal Corporation', biller_category: 'Water', state: 'Madhya Pradesh' },
    { biller_id: 'IMC_WATER', biller_name: 'Indore Municipal Corporation', biller_category: 'Water', state: 'Madhya Pradesh' },
    { biller_id: 'JMC_WATER', biller_name: 'Jabalpur Municipal Corporation', biller_category: 'Water', state: 'Madhya Pradesh' },
    { biller_id: 'LMC_WATER', biller_name: 'Ludhiana Municipal Corporation', biller_category: 'Water', state: 'Punjab' },
    { biller_id: 'MCG_WATER', biller_name: 'Municipal Corporation of Gurugram', biller_category: 'Water', state: 'Haryana' },
    { biller_id: 'UIT_WATER', biller_name: 'Urban Improvement Trust (UIT)', biller_category: 'Water', state: 'Rajasthan' },

    // ───── BROADBAND / INTERNET ─────
    { biller_id: 'AIRTEL_BB', biller_name: 'Airtel Broadband', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'JIO_FIBER', biller_name: 'Jio Fiber', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'BSNL_BB', biller_name: 'BSNL Broadband', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'ACT_BB', biller_name: 'ACT Fibernet', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'HATHWAY', biller_name: 'Hathway Broadband', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'TATA_PLAY_BB', biller_name: 'Tata Play Broadband', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'YOU_BB', biller_name: 'YOU Broadband', biller_category: 'Broadband', state: 'National' },
    { biller_id: 'ASIANET_BB', biller_name: 'Asianet Broadband (Kerala)', biller_category: 'Broadband', state: 'Kerala' },
    { biller_id: 'DEN_BB', biller_name: 'DEN Networks', biller_category: 'Broadband', state: 'National' },

    // ───── MOBILE POSTPAID ─────
    { biller_id: 'AIRTEL_POST', biller_name: 'Airtel Postpaid', biller_category: 'Mobile Postpaid', state: 'National' },
    { biller_id: 'JIO_POST', biller_name: 'Jio Postpaid', biller_category: 'Mobile Postpaid', state: 'National' },
    { biller_id: 'VI_POST', biller_name: 'Vi (Vodafone Idea) Postpaid', biller_category: 'Mobile Postpaid', state: 'National' },
    { biller_id: 'BSNL_POST', biller_name: 'BSNL Mobile Postpaid', biller_category: 'Mobile Postpaid', state: 'National' },
    { biller_id: 'MTNL_POST', biller_name: 'MTNL Postpaid (Mumbai/Delhi)', biller_category: 'Mobile Postpaid', state: 'National' },

    // ───── DTH ─────
    { biller_id: 'TATA_PLAY', biller_name: 'Tata Play (DTH)', biller_category: 'DTH', state: 'National' },
    { biller_id: 'DISH_TV', biller_name: 'Dish TV', biller_category: 'DTH', state: 'National' },
    { biller_id: 'AIRTEL_DTH', biller_name: 'Airtel DTH (Xstream)', biller_category: 'DTH', state: 'National' },
    { biller_id: 'SUN_DTH', biller_name: 'Sun Direct DTH', biller_category: 'DTH', state: 'National' },
    { biller_id: 'VIDEOCON_DTH', biller_name: 'D2H (Videocon DTH)', biller_category: 'DTH', state: 'National' },
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

    const hash = (consumerNumber + billerId).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const amount = (hash % 2000) + 100;

    // Simulate "No Active Bill" / "All Bills Paid" if the consumer number ends in an even digit
    const lastChar = consumerNumber.charAt(consumerNumber.length - 1);
    const isEven = /[02468]/.test(lastChar);

    if (isEven) {
        return {
            bill_id: `BBPS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            amount: 0,
            due_date: dueDate.toISOString().split('T')[0],
            consumer_name: 'Customer ' + consumerNumber.substring(0, 4),
            status: 'PAID'
        };
    }

    return {
        bill_id: `BBPS-${billerId.substring(0, 3)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        amount: amount,
        due_date: dueDate.toISOString().split('T')[0],
        consumer_name: 'Customer ' + (consumerNumber.substring(0, 4) || 'X'),
        status: 'GENERATED'
    };
};

export interface Quote {
    provider_name: string;
    premium: number;
    coverage: number;
    features: string[];
    claim_settlement_ratio?: number;
    network_hospitals?: number;
    key_inclusions?: string[];
    key_exclusions?: string[];
    // Generic key-value spec table shown in details modal (works for all categories)
    policy_details?: Record<string, string>;
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
                provider_name: 'Star Health', premium: Math.round(base * 1.15), coverage: 500000,
                features: ['Cashless', 'No Room Rent Capping', 'Free Annual Checkup'],
                claim_settlement_ratio: 90.1, network_hospitals: 14000,
                key_inclusions: ['Hospital bills paid directly — no cash needed', 'Doctor checkups before & after hospitalization covered', 'Yoga, Ayurveda & alternative treatments covered', 'Minor surgeries done in a day (no overnight stay) covered'],
                key_exclusions: ['Old illnesses you already had need 3 years before coverage kicks in', 'Teeth cleaning, braces & hairfall treatment not covered', 'Injuries that you caused to yourself on purpose not covered'],
                policy_details: {
                    'Room Rent Limit': 'Single Private A/C Room',
                    'Co-payment': 'No Co-payment',
                    'No Claim Bonus': '25% per year, max 100%',
                    'Pre / Post Hospitalization': '60 / 90 Days',
                    'PED Waiting Period': '3 Years',
                    'Day Care Treatments': 'All Procedures Covered',
                    'Restoration Benefit': '100% Basic Sum Insured once/yr',
                }
            },
            {
                provider_name: 'HDFC ERGO', premium: Math.round(base * 1.40), coverage: 500000,
                features: ['Global Cover', 'Restore Benefit', 'Wide Network'],
                claim_settlement_ratio: 98.4, network_hospitals: 13000,
                key_inclusions: ['You pay zero — insurer covers 100% of the bill', 'Air ambulance if needed in emergencies', 'Surgery costs for organ donor also covered', 'Works even if you travel abroad for treatment'],
                key_exclusions: ['Pregnancy & delivery not covered by default', 'Dentist bills (filling, extraction) not covered', 'Vaccines like flu shots not covered'],
                policy_details: {
                    'Room Rent Limit': 'No Limit (Any Room)',
                    'Co-payment': 'No Co-payment',
                    'No Claim Bonus': '50% per year, max 100%',
                    'Pre / Post Hospitalization': '60 / 180 Days',
                    'PED Waiting Period': '2 Years',
                    'Day Care Treatments': 'All Procedures Covered',
                    'Restoration Benefit': 'Unlimited Restoration',
                }
            },
            {
                provider_name: 'Care Health', premium: Math.round(base * 1.05), coverage: 500000,
                features: ['Ayush Cover', 'Annual Checkup', 'No Co-Payment'],
                claim_settlement_ratio: 95.2, network_hospitals: 22000,
                key_inclusions: ['Free full body checkup every year for everyone in policy', 'Ayurveda, Homeopathy & other traditional treatments covered', 'ICU charges fully covered during hospitalization', '540+ types of day procedures covered without overnight stay'],
                key_exclusions: ['No coverage for any sickness in the first 30 days of buying', 'Regular doctor visits (without hospitalization) not covered', 'Health supplements like protein powder not covered'],
                policy_details: {
                    'Room Rent Limit': 'Single Private Room',
                    'Co-payment': '20% co-pay for age 61+',
                    'No Claim Bonus': '10% per year, max 50%',
                    'Pre / Post Hospitalization': '30 / 60 Days',
                    'PED Waiting Period': '4 Years',
                    'Day Care Treatments': '540+ Procedures',
                    'Restoration Benefit': '100% Restoration once/yr',
                }
            },
            {
                provider_name: 'Niva Bupa', premium: Math.round(base * 1.25), coverage: 500000,
                features: ['ReAssure Benefit', 'Booster Benefit', 'Any Room Category'],
                claim_settlement_ratio: 92.5, network_hospitals: 10000,
                key_inclusions: ['Unlimited free doctor calls on phone/video', 'Annual health checkup included', 'If you don\'t claim, your coverage grows by 100% next year', 'Any type of hospital room — no restrictions'],
                key_exclusions: ['Pregnancy covered only after 3 years of policy', 'Injuries from bungee jumping, racing, extreme sports not covered'],
                policy_details: {
                    'Room Rent Limit': 'No Limit (Any Room)',
                    'Co-payment': 'No Co-payment',
                    'No Claim Bonus': 'Booster Benefit (+100% next yr)',
                    'Pre / Post Hospitalization': '60 / 90 Days',
                    'PED Waiting Period': '3 Years',
                    'Day Care Treatments': 'All Procedures Covered',
                    'Restoration Benefit': 'ReAssure (Unlimited)',
                }
            },
            {
                provider_name: 'ICICI Lombard', premium: Math.round(base * 1.30), coverage: 500000,
                features: ['BeFit Cover', 'Quick Claim Settlement', 'Cumulative Bonus'],
                claim_settlement_ratio: 97.8, network_hospitals: 7500,
                key_inclusions: ['Bills 60 days before your hospital admission covered', 'Bills 90 days after discharge also covered', 'Free fitness & wellness app access via BeFit', 'Cover grows automatically each year without extra premium'],
                key_exclusions: ['Treatment taken outside India not covered', 'Injuries from adventure sports like paragliding not covered'],
                policy_details: {
                    'Room Rent Limit': 'Single Private A/C Room',
                    'Co-payment': 'No Co-payment',
                    'No Claim Bonus': '10% per year, max 50%',
                    'Pre / Post Hospitalization': '60 / 90 Days',
                    'PED Waiting Period': '2 Years',
                    'Day Care Treatments': 'All Procedures Covered',
                    'Restoration Benefit': '100% Basic Sum Insured once/yr',
                }
            }
        ];
    }

    if (type === 'life') {
        const base = Math.round(6000 * ageLoadFactor);
        return [
            {
                provider_name: 'LIC Term Plan', premium: Math.round(base * 1.0), coverage: 5000000,
                features: ['Death Benefit', 'Accidental Cover', 'Sovereign Guarantee'],
                claim_settlement_ratio: 98.62,
                key_inclusions: ['Family gets full payout if anything happens to you', 'Accident death also fully covered', 'COVID-19 death covered', 'Save up to ₹46,800 tax every year under 80C'],
                key_exclusions: ['No payout if death happens within 12 months of buying due to suicide', 'Death while doing something illegal not covered'],
                policy_details: {
                    'Policy Type': 'Pure Term Plan',
                    'Premium Payment Term': 'Regular Pay (Annual)',
                    'Accidental Death Benefit': 'Included (Rider)',
                    'Critical Illness Cover': 'Not Included (Rider available)',
                    'Return of Premium': 'Not available',
                    'Tax Benefit': 'u/s 80C & 10(10D)',
                    'Max Entry Age': '65 Years',
                }
            },
            {
                provider_name: 'HDFC Life Click2Protect', premium: Math.round(base * 1.15), coverage: 5000000,
                features: ['Critical Illness Option', 'Return of Premium', 'Income Benefit'],
                claim_settlement_ratio: 99.39,
                key_inclusions: ['Get money immediately if diagnosed with cancer, heart attack etc.', 'Covers 34 serious illnesses with lump-sum payout', 'If you become disabled, future premiums are waived', 'Option to get all your premiums back if no claim made'],
                key_exclusions: ['Medical history you hid while buying won\'t be covered', 'No payout in first year if death is by suicide'],
                policy_details: {
                    'Policy Type': 'Term + Critical Illness',
                    'Premium Payment Term': 'Regular / Limited Pay',
                    'Accidental Death Benefit': 'Included',
                    'Critical Illness Cover': '34 Critical Illnesses',
                    'Return of Premium': 'Available (Higher Premium)',
                    'Tax Benefit': 'u/s 80C & 10(10D)',
                    'Max Entry Age': '65 Years',
                }
            },
            {
                provider_name: 'Max Life Smart Secure', premium: Math.round(base * 0.9), coverage: 5000000,
                features: ['Waiver of Premium', 'Terminal Illness Benefit', 'Instalment Payouts'],
                claim_settlement_ratio: 99.51,
                key_inclusions: ['Diagnosed with terminal illness? Receive payout immediately — don\'t wait', 'Extra payout if death is due to an accident', 'Option to get premiums refunded at end of term', 'Family can receive money as monthly income instead of lump sum'],
                key_exclusions: ['Death doing risky sports like car racing or skydiving not covered'],
                policy_details: {
                    'Policy Type': 'Pure Term Plan',
                    'Premium Payment Term': 'Regular / Single Pay',
                    'Accidental Death Benefit': 'Available (Rider)',
                    'Critical Illness Cover': 'Available (Rider)',
                    'Return of Premium': 'Available',
                    'Tax Benefit': 'u/s 80C & 10(10D)',
                    'Max Entry Age': '60 Years',
                }
            },
            {
                provider_name: 'SBI Life eShield', premium: Math.round(base * 1.05), coverage: 5000000,
                features: ['Increasing Cover', 'Affordable Premiums', 'Tax Benefits'],
                claim_settlement_ratio: 97.05,
                key_inclusions: ['Family gets full sum if anything happens to you', 'Extra payout for accidental death (add-on option)', 'Cover automatically increases over time to beat inflation', 'Save tax every year under Section 80C'],
                key_exclusions: ['Self-inflicted harm not covered', 'Death due to drug or alcohol abuse not covered'],
                policy_details: {
                    'Policy Type': 'Term Insurance',
                    'Premium Payment Term': 'Regular Pay',
                    'Accidental Death Benefit': 'Available (Add-on)',
                    'Critical Illness Cover': 'Not Included',
                    'Return of Premium': 'Not available',
                    'Tax Benefit': 'u/s 80C & 10(10D)',
                    'Max Entry Age': '60 Years',
                }
            },
            {
                provider_name: 'Tata AIA MahaLife', premium: Math.round(base * 1.2), coverage: 5000000,
                features: ['Whole Life Cover', 'Guaranteed Returns', 'Health Riders'],
                claim_settlement_ratio: 99.01,
                key_inclusions: ['Get a lump sum payout when you turn 100 (or family gets it)', 'Coverage continues your entire life — not just 30-40 years', 'Add riders for critical illness or accidents', 'Guaranteed payback — never lose what you paid'],
                key_exclusions: ['Death while breaking the law not covered', 'Death from infection/disease in very first year not covered'],
                policy_details: {
                    'Policy Type': 'Whole Life Plan',
                    'Premium Payment Term': 'Limited Pay (Up to age 100)',
                    'Accidental Death Benefit': 'Included',
                    'Critical Illness Cover': 'Available via Rider',
                    'Return of Premium': 'At maturity (age 100)',
                    'Tax Benefit': 'u/s 80C & 10(10D)',
                    'Max Entry Age': '60 Years',
                }
            }
        ];
    }

    if (type === 'vehicle') {
        const basePremium = Math.max(2000, targetValue * 0.03);
        return [
            {
                provider_name: 'Acko General', premium: Math.round(basePremium * 0.9), coverage: targetValue,
                features: ['Zero Dep', 'Doorstep Pickup', 'No Claim Bonus Protection'],
                claim_settlement_ratio: 95.5, network_hospitals: 4000,
                key_inclusions: ['Car damaged in accident? We fix it at no extra cost', 'If your car gets stolen, you get the full value', 'Flood, earthquake or fire damage covered', 'If you hit someone else\'s car, we pay for their damage too', 'No premium hike even if you claim (NCB protection)'],
                key_exclusions: ['Claim rejected if you were drunk while driving', 'No coverage if you drove without a valid licence', 'Engine wear over time or mechanical faults not covered'],
                policy_details: {
                    'Plan Type': 'Comprehensive',
                    'Zero Depreciation': 'Included',
                    'No Claim Bonus (NCB)': 'Up to 50%',
                    'NCB Protection': 'Available',
                    'Engine Protection': 'Not Included',
                    'Roadside Assistance': '24x7 (Included)',
                    'Personal Accident Cover': '₹15 Lakh',
                    'Cashless Garages': '4,000+',
                }
            },
            {
                provider_name: 'Go Digit', premium: Math.round(basePremium * 0.95), coverage: targetValue,
                features: ['Zero Dep', '24x7 Roadside', 'Smart Claim App'],
                claim_settlement_ratio: 96.0, network_hospitals: 5800,
                key_inclusions: ['You\'re personally covered for injury in an accident — up to ₹15L', 'Taken your car to a garage in our network? No bills, we settle directly', 'File claim from your phone in minutes via the app', '24x7 towing if your car breaks down anywhere'],
                key_exclusions: ['Tyre/brake wear over time not covered — that\'s expected maintenance', 'Damage caused because of a previous unrepaired part not covered'],
                policy_details: {
                    'Plan Type': 'Comprehensive',
                    'Zero Depreciation': 'Included',
                    'No Claim Bonus (NCB)': 'Up to 50%',
                    'NCB Protection': 'Not Included',
                    'Engine Protection': 'Add-on available',
                    'Roadside Assistance': '24x7 (Included)',
                    'Personal Accident Cover': '₹15 Lakh',
                    'Cashless Garages': '5,800+',
                }
            },
            {
                provider_name: 'ICICI Lombard', premium: Math.round(basePremium * 1.1), coverage: targetValue,
                features: ['Engine Protect', 'Consumables Cover', 'Anywhere Repair'],
                claim_settlement_ratio: 97.2, network_hospitals: 6100,
                key_inclusions: ['Items stolen from inside the car (laptop, bag etc.) covered', 'Engine damage from water flooding also covered', '24x7 roadside help — flat tyre, battery jump, towing', 'Consumables like oil & nuts replaced after accident covered too'],
                key_exclusions: ['Using your personal car as a cab/taxi & then claiming not covered', 'Accident while driving drunk or intoxicated not covered'],
                policy_details: {
                    'Plan Type': 'Comprehensive + Engine Protect',
                    'Zero Depreciation': 'Included',
                    'No Claim Bonus (NCB)': 'Up to 50%',
                    'NCB Protection': 'Included',
                    'Engine Protection': 'Included',
                    'Roadside Assistance': '24x7 (Included)',
                    'Personal Accident Cover': '₹15 Lakh',
                    'Cashless Garages': '6,100+',
                }
            },
            {
                provider_name: 'Bajaj Allianz', premium: Math.round(basePremium * 1.15), coverage: targetValue,
                features: ['DriveSmart Telematics', 'Zero Depreciation', 'Key Replacement'],
                claim_settlement_ratio: 98.0, network_hospitals: 6500,
                key_inclusions: ['If car is total loss, you get the showroom invoice amount — not depreciated value', 'Engine & gearbox damage also covered (usually excluded elsewhere)', 'DriveSmart app rewards safe driving with lower premiums', 'Key lost? Replacement covered too'],
                key_exclusions: ['Driving your car outside India and having an accident there not covered', 'Damage from racing, stunts or speed testing not covered'],
                policy_details: {
                    'Plan Type': 'Comprehensive (Premium)',
                    'Zero Depreciation': 'Included',
                    'No Claim Bonus (NCB)': 'Up to 50%',
                    'NCB Protection': 'Included',
                    'Engine Protection': 'Engine & Gearbox included',
                    'Roadside Assistance': '24x7 (Included)',
                    'Personal Accident Cover': '₹15 Lakh',
                    'Cashless Garages': '6,500+',
                }
            },
            {
                provider_name: 'Reliance General', premium: Math.round(basePremium * 0.85), coverage: targetValue,
                features: ['EMI Protector', 'Daily Allowance', 'Free Towing'],
                claim_settlement_ratio: 91.5, network_hospitals: 4500,
                key_inclusions: ['If you damage someone else\'s property, we pay for it', 'Any passenger in your car is also covered for injuries', 'Free towing service if car breaks down', 'Daily allowance while your car is in workshop'],
                key_exclusions: ['Damage from mechanical failure (engine breakdown on its own) not covered', 'Damage from using car for commercial delivery not covered'],
                policy_details: {
                    'Plan Type': 'Comprehensive (Budget)',
                    'Zero Depreciation': 'Add-on available',
                    'No Claim Bonus (NCB)': 'Up to 50%',
                    'NCB Protection': 'Not Included',
                    'Engine Protection': 'Not Included',
                    'Roadside Assistance': 'Free Towing included',
                    'Personal Accident Cover': '₹15 Lakh',
                    'Cashless Garages': '4,500+',
                }
            }
        ];
    }

    if (type === 'property') {
        const base = Math.round(targetValue * 0.0005);
        return [
            {
                provider_name: 'SBI General (Bharat Griha)', premium: Math.round(base * 1.0), coverage: targetValue,
                features: ['Fire Protection', 'Natural Calamities', 'Theft Cover'],
                claim_settlement_ratio: 95.0,
                key_inclusions: ['House damaged in earthquake? Covered', 'Flood, cyclone or storm damage to your home covered', 'Riot or civil unrest damages also covered', 'Fire damage inside or outside home covered'],
                key_exclusions: ['Cash or gold kept at home NOT covered — keep them in bank/locker', 'Damage you cause on purpose to your own home not covered', 'Cracks/paint peeling over time (normal aging) not covered'],
                policy_details: {
                    'Structure Cover': 'Included',
                    'Contents Cover': 'Add-on available',
                    'Jewellery Protection': 'Not Included',
                    'Terrorism Cover': 'Included',
                    'Loss of Rent': 'Not Included',
                    'Public Liability': 'Not Included',
                    'Alternate Accommodation': 'Not Included',
                    'Policy Tenure': 'Annual',
                }
            },
            {
                provider_name: 'Bajaj Allianz Home', premium: Math.round(base * 1.2), coverage: targetValue,
                features: ['Contents Cover', 'Burglary', 'Jewelry Protection'],
                claim_settlement_ratio: 98.1,
                key_inclusions: ['Laptop, TV, fridge & electronics inside home covered', 'Can\'t stay in your house after damage? We pay your rent elsewhere', 'If someone gets injured in your home, their bills covered too', 'Jewellery & valuables covered up to ₹1 lakh'],
                key_exclusions: ['Someone stealing from your home without breaking in (e.g. maid theft) not covered', 'Damage from landslide or soil erosion not covered'],
                policy_details: {
                    'Structure Cover': 'Included',
                    'Contents Cover': 'Included',
                    'Jewellery Protection': 'Up to ₹1 Lakh',
                    'Terrorism Cover': 'Included',
                    'Loss of Rent': 'Included',
                    'Public Liability': 'Included',
                    'Alternate Accommodation': 'Up to 3 months',
                    'Policy Tenure': 'Annual / Long-term',
                }
            },
            {
                provider_name: 'HDFC ERGO Home', premium: Math.round(base * 1.4), coverage: targetValue,
                features: ['Complete Protection', 'Alternative Accommodation', 'Electronic Equipment'],
                claim_settlement_ratio: 97.4,
                key_inclusions: ['Walls, roof, structure damage covered comprehensively', 'Terrorist attack damage included', 'You get personal accident cover too if injured at home', 'Alternate accommodation paid if home is uninhabitable for up to 12 months'],
                key_exclusions: ['Damage from slow water seepage or dampness over years not covered', 'Pets or farm animals not covered under home policy'],
                policy_details: {
                    'Structure Cover': 'Included',
                    'Contents Cover': 'Included',
                    'Jewellery Protection': 'Up to ₹2 Lakh',
                    'Terrorism Cover': 'Included',
                    'Loss of Rent': 'Up to 12 months',
                    'Public Liability': 'Included',
                    'Alternate Accommodation': 'Included',
                    'Policy Tenure': 'Annual / 2 yr / 3 yr',
                }
            }
        ];
    }

    if (type === 'medical') {
        const base = Math.round(5000 * ageLoadFactor);
        return [
            {
                provider_name: 'Niva Bupa (OPD)', premium: Math.round(base * 1.0), coverage: 300000,
                features: ['OPD Cover', 'Teleconsultation', 'High Claim Ratio'],
                claim_settlement_ratio: 92.5, network_hospitals: 10000,
                key_inclusions: ['Walk-in doctor visit bills covered (no hospitalization needed)', 'Tests, scans, blood reports & medicine bills covered', 'Unlimited free doctor video/phone calls', 'New baby covered from birth'],
                key_exclusions: ['Botox, skin lightening, hair transplant etc. not covered', 'Treatments not approved by medical authorities not covered'],
                policy_details: {
                    'OPD Cover': 'Included (₹25,000/yr)',
                    'Teleconsultation': 'Unlimited',
                    'Maternity Cover': 'After 2 yr waiting period',
                    'New Born Cover': 'Included (from birth)',
                    'Annual Health Checkup': 'Included (1 per year)',
                    'Dental & Vision': 'Add-on available',
                    'Mental Health Cover': 'Included',
                }
            },
            {
                provider_name: 'Aditya Birla Health', premium: Math.round(base * 1.1), coverage: 300000,
                features: ['Wellness Rewards', 'Chronic Care Management', 'Daycare Procedures'],
                claim_settlement_ratio: 94.1, network_hospitals: 10500,
                key_inclusions: ['Diabetes, BP, thyroid covered from Day 1 — no waiting', 'Gym membership cashback through HealthReturns rewards', 'OPD bills up to ₹30,000 a year covered directly', 'Annual checkup for entire family included'],
                key_exclusions: ['Protein supplements or dietary supplements not covered', 'Any illness that starts in the first 30 days not covered'],
                policy_details: {
                    'OPD Cover': 'Up to ₹30,000/yr',
                    'Teleconsultation': 'Unlimited',
                    'Maternity Cover': 'Included (after 9 months)',
                    'New Born Cover': 'Day 1 cover',
                    'Annual Health Checkup': 'Included (all members)',
                    'Dental & Vision': 'OPD benefit covers',
                    'Mental Health Cover': 'Included',
                }
            },
            {
                provider_name: 'ManipalCigna', premium: Math.round(base * 0.95), coverage: 300000,
                features: ['No Sub-Limits', 'Cashless', 'Worldwide Cover'],
                claim_settlement_ratio: 89.2, network_hospitals: 8500,
                key_inclusions: ['Medical emergency anywhere in the world covered', 'No yearly claim? Your coverage keeps building up', 'Robotic surgeries & modern treatments covered', 'No sub-limits — claim full amount for any procedure'],
                key_exclusions: ['Ayurveda, Homeopathy etc. only covered if doctor prescribes it', 'STDs not covered under this plan'],
                policy_details: {
                    'OPD Cover': 'Add-on available',
                    'Teleconsultation': 'Included',
                    'Maternity Cover': 'Add-on (after 36 months)',
                    'New Born Cover': 'Included after maternity add-on',
                    'Annual Health Checkup': 'Included',
                    'Dental & Vision': 'Not Included',
                    'Mental Health Cover': 'Included',
                }
            }
        ];
    }

    // Default mock
    return [
        {
            provider_name: 'Generic Insurance Co.', premium: 5000, coverage: 200000, features: ['Standard Cover'],
            claim_settlement_ratio: 90.0, key_inclusions: ['Standard hospitalisation'], key_exclusions: ['Pre-existing diseases'],
            policy_details: { 'Cover Type': 'Basic', 'Waiting Period': '30 Days' }
        }
    ];
};
