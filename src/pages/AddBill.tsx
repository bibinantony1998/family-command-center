import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Search, Receipt, Info } from 'lucide-react';
import { MOCK_BILLERS, fetchMockBillFromBBPS, INDIAN_STATES } from '../lib/api/bbps';
import type { MockBillResponse } from '../lib/api/bbps';
import { Toast, type ToastType } from '../components/ui/Toast';
import { Select } from '../components/ui/Select';

export default function AddBill() {
    const navigate = useNavigate();
    const { user, profile, currentFamily } = useAuth();

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [step, setStep] = useState<1 | 2>(1);

    // Read URL param
    const queryParams = new URLSearchParams(window.location.search);
    const initialCategory = queryParams.get('category');

    // Mapped Category helper
    const targetCat = React.useMemo(() => {
        if (!initialCategory) return '';
        const lowerCat = initialCategory.toLowerCase();
        if (lowerCat === 'electricity') return 'Electricity';
        if (lowerCat === 'water') return 'Water';
        if (lowerCat === 'gas') return 'Gas';
        if (lowerCat === 'mobile_postpaid') return 'Mobile Postpaid';
        if (lowerCat === 'broadband') return 'Broadband';
        if (lowerCat === 'dth') return 'DTH';
        return '';
    }, [initialCategory]);

    // Per-biller consumer ID configuration
    const CONSUMER_ID_CONFIG: Record<string, { label: string; placeholder: string; hint: string }> = {
        // Electricity — most use "Consumer Number"
        'BESCOM': { label: 'Consumer Number', placeholder: 'e.g. 4001234567', hint: 'Found on your BESCOM bill top-right' },
        'MSEDCL': { label: 'Consumer Number', placeholder: 'e.g. 1234567890', hint: 'Found on top of your MSEDCL bill' },
        'KSEB': { label: 'Consumer Number', placeholder: 'e.g. 2001234567', hint: 'On your KSEB bill, starts with 2' },
        'KSEBL': { label: 'Consumer Number', placeholder: 'e.g. 2001234567', hint: 'On your KSEBL bill, starts with 2' },
        'TCED': { label: 'Consumer Number', placeholder: 'e.g. 100012345', hint: 'Consumer Number on your Thrissur Corporation bill' },
        'KANNUR_ELEC': { label: 'Consumer Number', placeholder: 'e.g. 100012345', hint: 'Consumer Number on your Kannur Electricity bill' },
        'KDHP': { label: 'Consumer Number', placeholder: 'e.g. 100012345', hint: 'Consumer Number on your KDHP Munnar bill' },
        'MePDCL': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Meghalaya bill' },
        'TSECL': { label: 'Consumer Account Number', placeholder: 'e.g. 123456789', hint: 'Account Number on your Tripura bill' },
        'MSPDCL': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Manipur bill' },
        'DOP_NAGALAND': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Nagaland bill' },
        'DOP_ARUNACHAL': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Arunachal Pradesh bill' },
        'SIKKIM_POWER': { label: 'Contract Account Number', placeholder: 'e.g. 123456789', hint: 'Account Number on your Sikkim bill' },
        'PED_MIZORAM': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Mizoram bill' },
        'ED_CHANDIGARH': { label: 'Account Number', placeholder: 'e.g. 123456789', hint: 'Account Number on your Chandigarh bill' },
        'ED_PUDUCHERRY': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Number on your Puducherry bill' },
        'DNHPDCL': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your DNHPDCL bill' },
        'ED_ANDAMAN': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Andaman bill' },
        'LAKSHADWEEP_ED': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Lakshadweep bill' },
        'GIFT_POWER': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Gift Power bill' },
        'IPCL': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your IPCL bill' },
        'TORRENT_AGRA': { label: 'Consumer Number', placeholder: 'e.g. 123456789', hint: 'Consumer Number on your Torrent Power Agra bill' },
        'TPDDL': { label: 'CA Number', placeholder: 'e.g. 302XXXXXXX', hint: '11-digit CA Number on your bill' },
        'BRPL': { label: 'Consumer Account No.', placeholder: 'e.g. 3100XXXXXX', hint: 'On your BSES Rajdhani bill' },
        'BYPL': { label: 'Consumer Account No.', placeholder: 'e.g. 6100XXXXXX', hint: 'On your BSES Yamuna bill' },
        'TANGEDCO': { label: 'Service Connection Number', placeholder: 'e.g. 069000000000', hint: 'SC No. on your TANGEDCO bill' },
        'APEPDCL': { label: 'Service Number', placeholder: 'e.g. 1234567890', hint: 'Service No. on your AP bill' },
        'APCPDCL': { label: 'Service Number', placeholder: 'e.g. 1234567890', hint: 'Service No. on your AP bill' },
        'APSPDCL': { label: 'Service Number', placeholder: 'e.g. 1234567890', hint: 'Service No. on your AP bill' },
        'TSNPDCL': { label: 'Consumer Number (SC No.)', placeholder: 'e.g. 123456789012', hint: 'SC No. found on Telangana bill' },
        'TSSPDCL': { label: 'Consumer Number (SC No.)', placeholder: 'e.g. 123456789012', hint: 'SC No. found on Telangana bill' },
        'UPPCL': { label: 'Account Number', placeholder: 'e.g. 12-digit account no.', hint: 'Consumer Account No. on UP bill' },
        'PSPCL': { label: 'Account ID', placeholder: 'e.g. 3214567890', hint: '10-digit Account ID on Punjab bill' },
        'JVVNL': { label: 'K. Number', placeholder: 'e.g. K-1234567890', hint: 'K. Number on your Jaipur bill' },
        'WBSEDCL': { label: 'Consumer ID', placeholder: 'e.g. 901XXXXXXX', hint: '10-digit Consumer ID on WB bill' },
        // Gas — LPG
        'HPGAS': { label: 'LPG Consumer ID / Reg. No.', placeholder: 'e.g. 12-digit ID', hint: 'Found on your HP Gas booklet or app' },
        'BHARATGAS': { label: 'Consumer No. / CA Number', placeholder: 'e.g. 10-digit number', hint: 'CA No. on your Bharat Gas card' },
        'INDANE': { label: 'Consumer Number', placeholder: 'e.g. 9-digit number', hint: 'Consumer No. on your Indane card' },
        // Gas — PNG/CNG
        'IGL': { label: 'BP Number', placeholder: 'e.g. 10-digit BP No.', hint: 'BP No. on your IGL bill/app' },
        'MGL': { label: 'Consumer Number', placeholder: 'e.g. 10-digit number', hint: 'Consumer No. on your MGL bill' },
        'GGL': { label: 'Consumer No.', placeholder: 'e.g. 9-digit number', hint: 'On your Gujarat Gas bill' },
        'ADANI_TOTAL_GAS': { label: 'Consumer No.', placeholder: 'e.g. 10-digit number', hint: 'On your Adani Gas bill' },
        'MNGL': { label: 'Consumer Number', placeholder: 'e.g. 9-digit number', hint: 'Consumer No. on your MNGL bill' },
        'BENGAL_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Bengal Gas bill' },
        'CUGL': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your CUGL bill' },
        'CHAROTAR_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Charotar Gas bill' },
        'GOA_NATURAL_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Goa Natural Gas bill' },
        'GODAVARI_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Godavari Gas bill' },
        'HARYANA_CITY_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Haryana City Gas bill' },
        'IOAGPL': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your IOAGPL bill' },
        'IOCL_PNG': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your IOCL Piped Gas bill' },
        'IRM_ENERGY': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your IRM Energy bill' },
        'MEGHA_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Megha Gas bill' },
        'NAVERIYA_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Naveriya Gas bill' },
        'PURBA_BHARATI_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Purba Bharati Gas bill' },
        'RAJASTHAN_STATE_GAS': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Rajasthan State Gas bill' },
        'SITI_ENERGY': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Siti Energy bill' },
        'VGL': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your Vadodara Gas bill' },
        // Water
        'BWSSB': { label: 'Service Connection No.', placeholder: 'e.g. 10000XXXXX', hint: 'SCN on your BWSSB bill' },
        'DJB': { label: 'Consumer No. (K No.)', placeholder: 'e.g. KX-XXXXXXXX', hint: 'K. No. on your Delhi Jal Board bill' },
        'MCGM_WATER': { label: 'Consumer ID', placeholder: 'e.g. 12-digit ID', hint: 'Consumer ID on your MCGM water bill' },
        'CMWSSB': { label: 'Consumer No.', placeholder: 'e.g. 10-digit number', hint: 'On your Chennai Metro Water bill' },
        'HMWS_SB': { label: 'Consumer No.', placeholder: 'e.g. 10-digit number', hint: 'On your Hyderabad water bill' },
        'AMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your AMC water bill' },
        'BMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your BMC water bill' },
        'GWMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your GWMC water bill' },
        'GMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your GMC water bill' },
        'IMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your IMC water bill' },
        'JMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your JMC water bill' },
        'LMC_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your LMC water bill' },
        'MCG_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your MCG water bill' },
        'UIT_WATER': { label: 'Consumer Number', placeholder: 'e.g. 12345678', hint: 'Consumer Number on your UIT water bill' },
        // Broadband
        'AIRTEL_BB': { label: 'Account ID / Mobile No.', placeholder: 'e.g. 10-digit mobile', hint: 'Registered mobile or Account ID' },
        'JIO_FIBER': { label: 'Account Number', placeholder: 'e.g. JF-XXXXXXXXX', hint: 'Account No. in Jio app → My Account' },
        'BSNL_BB': { label: 'Landline / Account No.', placeholder: 'e.g. 044-XXXXXXXX', hint: 'BSNL landline or account number' },
        'ACT_BB': { label: 'Account ID', placeholder: 'e.g. 1000XXXXXXX', hint: 'Account ID from ACT app/welcome mail' },
        'HATHWAY': { label: 'Consumer ID', placeholder: 'e.g. 8-10 digit ID', hint: 'Consumer ID on Hathway invoice' },
        'TATA_PLAY_BB': { label: 'Account ID', placeholder: 'e.g. 8-digit ID', hint: 'Account ID from Tata Play welcome mail' },
        // Mobile Postpaid
        'AIRTEL_POST': { label: 'Mobile Number', placeholder: 'e.g. 9876543210', hint: 'Your 10-digit Airtel postpaid number' },
        'JIO_POST': { label: 'Mobile Number', placeholder: 'e.g. 9876543210', hint: 'Your 10-digit Jio postpaid number' },
        'VI_POST': { label: 'Mobile Number', placeholder: 'e.g. 9876543210', hint: 'Your 10-digit Vi postpaid number' },
        'BSNL_POST': { label: 'Mobile Number', placeholder: 'e.g. 9876543210', hint: 'Your 10-digit BSNL postpaid number' },
        // DTH
        'TATA_PLAY': { label: 'Subscriber ID', placeholder: 'e.g. 1XXXXXXXXX', hint: '9-10 digit Subscriber ID on Tata Play card' },
        'DISH_TV': { label: 'VC Number', placeholder: 'e.g. 12-digit VC No.', hint: 'VC No. on your Dish TV viewing card' },
        'AIRTEL_DTH': { label: 'Customer ID', placeholder: 'e.g. 3XXXXXXXXX', hint: 'Customer ID on your Airtel DTH card' },
        'SUN_DTH': { label: 'Subscriber ID', placeholder: 'e.g. 10-digit ID', hint: 'Subscriber ID on Sun Direct card' },
        'VIDEOCON_DTH': { label: 'VC Number', placeholder: 'e.g. 12-digit VC No.', hint: 'VC No. on your D2H viewing card' },
    };



    // Form State — no default selection, user must choose
    const [selectedState, setSelectedState] = useState<string>('');
    const [selectedBiller, setSelectedBiller] = useState<string>('');

    // Available Billers for this category
    const availableBillers = React.useMemo(() => {
        let billers = MOCK_BILLERS;
        if (targetCat) {
            billers = billers.filter(b => b.biller_category === targetCat);
        }
        if (selectedState) {
            billers = billers.filter(b => b.state === selectedState || b.state === 'National');
        }
        return billers.sort((a, b) => a.biller_name.localeCompare(b.biller_name));
    }, [targetCat, selectedState]);
    const [consumerNumber, setConsumerNumber] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    const billerConfig = selectedBiller
        ? (CONSUMER_ID_CONFIG[selectedBiller] ?? { label: 'Consumer Number / Account ID', placeholder: 'e.g. 1234567890', hint: 'Find this on your bill or provider app' })
        : { label: 'Consumer Number / Account ID', placeholder: 'e.g. 1234567890', hint: 'Select a provider first' };

    // Fetched Bill State
    const [fetchedBill, setFetchedBill] = useState<MockBillResponse | null>(null);
    const [autoPay, setAutoPay] = useState(false);
    const [visibility, setVisibility] = useState<'public' | 'personal'>('public');

    const handleFetchBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBiller || !consumerNumber) return;

        try {
            setIsFetching(true);
            const bill = await fetchMockBillFromBBPS(selectedBiller, consumerNumber);
            setFetchedBill(bill);
            setStep(2);
        } catch {
            setToast({ message: "Failed to fetch bill. Please check the consumer number.", type: 'error' });
        } finally {
            setIsFetching(false);
        }
    };

    const handleSaveBill = async () => {
        if (!fetchedBill || !currentFamily?.id) return;

        try {
            const biller = MOCK_BILLERS.find(b => b.biller_id === selectedBiller);

            // Map category to enum
            let categoryEnum = 'other';
            if (biller?.biller_category === 'Electricity') categoryEnum = 'electricity';
            if (biller?.biller_category === 'Water') categoryEnum = 'water';
            if (biller?.biller_category === 'Mobile Postpaid') categoryEnum = 'mobile_postpaid';
            if (biller?.biller_category === 'Broadband') categoryEnum = 'broadband';

            const { error } = await supabase.from('bills').insert({
                family_id: currentFamily.id,
                category: categoryEnum,
                provider_name: biller?.biller_name || 'Unknown',
                consumer_number: consumerNumber,
                due_date: fetchedBill.due_date,
                amount: fetchedBill.amount,
                status: 'pending',
                auto_pay: autoPay,
                visibility: visibility,
                added_by: user?.id
            });

            if (error) throw error;

            navigate('/bills');
        } catch (error: Error | unknown) {
            console.error('Error linking bill:', error);
            setToast({ message: (error as Error).message || "Failed to link bill to family", type: 'error' });
        }
    };

    if (profile?.role !== 'parent') {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/bills')} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Link New Bill</h1>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                {step === 1 ? (
                    <form onSubmit={handleFetchBill} className="space-y-6">
                        <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            {!['Mobile Postpaid', 'DTH', 'Credit Card', 'Broadband'].includes(targetCat) && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select State</label>
                                    <Select
                                        value={selectedState}
                                        onChange={(val) => {
                                            setSelectedState(val);
                                            setSelectedBiller(''); // Reset biller when state changes
                                        }}
                                        placeholder="All States (India)"
                                        searchable={true}
                                        options={[
                                            { label: 'All States (India)', value: '' },
                                            ...INDIAN_STATES.filter(s => s !== 'National').sort().map(s => ({
                                                label: s,
                                                value: s
                                            }))
                                        ]}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Biller Provider</label>
                                <Select
                                    value={selectedBiller}
                                    onChange={setSelectedBiller}
                                    placeholder="-- Select a Provider --"
                                    searchable={true}
                                    options={availableBillers.map(b => ({
                                        label: b.biller_name,
                                        value: b.biller_id
                                    }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{billerConfig.label}</label>
                                <input
                                    type="text"
                                    required
                                    value={consumerNumber}
                                    onChange={e => setConsumerNumber(e.target.value)}
                                    placeholder={billerConfig.placeholder}
                                    disabled={!selectedBiller}
                                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 text-slate-800 font-medium shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                                {selectedBiller && (
                                    <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                                        <Info className="w-3 h-3" />{billerConfig.hint}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isFetching || !selectedBiller || !consumerNumber}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {isFetching ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent" /> : <Search className="w-5 h-5" />}
                            Fetch Bill Details
                        </button>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 flex items-start gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                                <Receipt className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 text-lg">Bill Found!</h3>
                                <p className="text-slate-600 mt-1">Consumer: <span className="font-semibold text-slate-900">{fetchedBill?.consumer_name}</span></p>
                                {fetchedBill?.status === 'PAID' || fetchedBill?.amount === 0 ? (
                                    <div className="mt-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-emerald-700">
                                        <p className="font-semibold text-emerald-800">No active bill found</p>
                                        <p className="text-sm mt-0.5">All previous bills are fully paid!</p>
                                    </div>
                                ) : (
                                    <div className="mt-4 bg-white p-4 rounded-lg border border-indigo-100 flex justify-between items-center">
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Due Amount</p>
                                            <p className="text-2xl font-bold text-red-600">₹{fetchedBill?.amount}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-slate-500 mb-1">Due Date</p>
                                            <p className="font-semibold text-slate-900">{fetchedBill?.due_date}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="autopay"
                                checked={autoPay}
                                onChange={e => setAutoPay(e.target.checked)}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <label htmlFor="autopay" className="text-slate-700 font-medium cursor-pointer">
                                Enable Auto-Pay for future bills
                            </label>
                        </div>

                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-start gap-4">
                            <Info className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-indigo-900 mb-2">Who can see this bill?</h4>
                                <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="public"
                                            checked={visibility === 'public'}
                                            onChange={() => setVisibility('public')}
                                            className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-indigo-800">Public (All Parents)</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="personal"
                                            checked={visibility === 'personal'}
                                            onChange={() => setVisibility('personal')}
                                            className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-indigo-800">Personal (Only Me)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSaveBill}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
                            >
                                Link to Account
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
