import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Search, Receipt, Info } from 'lucide-react';
import { MOCK_BILLERS, fetchMockBillFromBBPS } from '../lib/api/bbps';
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

    // Available Billers for this category
    const availableBillers = React.useMemo(() => {
        if (!targetCat) return MOCK_BILLERS; // Show all if no category specific
        return MOCK_BILLERS.filter(b => b.biller_category === targetCat);
    }, [targetCat]);

    // Auto-select provider based on available list
    const initialBiller = React.useMemo(() => {
        if (availableBillers.length > 0 && targetCat) {
            return availableBillers[0].biller_id;
        }
        return '';
    }, [availableBillers, targetCat]);

    // Form State
    const [selectedBiller, setSelectedBiller] = useState<string>(initialBiller);
    const [consumerNumber, setConsumerNumber] = useState('');
    const [isFetching, setIsFetching] = useState(false);

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
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Biller Provider</label>
                                <Select
                                    value={selectedBiller}
                                    onChange={setSelectedBiller}
                                    placeholder="-- Select a Provider --"
                                    options={availableBillers.map(b => ({
                                        label: b.biller_name,
                                        value: b.biller_id
                                    }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Consumer Number / Account ID</label>
                                <input
                                    type="text"
                                    required
                                    value={consumerNumber}
                                    onChange={e => setConsumerNumber(e.target.value)}
                                    placeholder="e.g. 1102938475"
                                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 text-slate-800 font-medium shadow-sm transition-all"
                                />
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
