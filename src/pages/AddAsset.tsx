import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Car, Home, Package } from 'lucide-react';
import { Toast, type ToastType } from '../components/ui/Toast';

export default function AddAsset() {
    const navigate = useNavigate();
    const { profile, currentFamily } = useAuth();

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [type, setType] = useState<'vehicle' | 'property' | 'other'>('vehicle');
    const [name, setName] = useState('');
    const [registration, setRegistration] = useState('');
    const [value, setValue] = useState('');

    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentFamily?.id || !profile?.id) return;

        try {
            setIsSaving(true);

            // Construct the JSONB details object
            const details: Record<string, string | number> = {
                name
            };

            if (type === 'vehicle' && registration) {
                details.registration_number = registration;
            }
            if (value) {
                details.estimated_value = parseFloat(value);
            }

            const { error } = await supabase.from('assets').insert({
                family_id: currentFamily.id,
                type,
                details,
                added_by: profile.id
            });

            if (error) throw error;

            navigate('/assets');
        } catch (error: Error | unknown) {
            console.error('Error adding asset:', error);
            setToast({ message: (error as Error).message || "Failed to add asset", type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (profile?.role !== 'parent') {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/assets')} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Add New Asset</h1>
            </div>

            <form onSubmit={handleSaveAsset} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">

                {/* Asset Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Asset Type</label>
                    <div className="grid grid-cols-3 gap-4">
                        <button
                            type="button"
                            onClick={() => setType('vehicle')}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${type === 'vehicle'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                                : 'border-slate-200 hover:border-indigo-300 text-slate-600'
                                }`}
                        >
                            <Car className="w-6 h-6" />
                            <span>Vehicle</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('property')}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${type === 'property'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                                : 'border-slate-200 hover:border-indigo-300 text-slate-600'
                                }`}
                        >
                            <Home className="w-6 h-6" />
                            <span>Property</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('other')}
                            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${type === 'other'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                                : 'border-slate-200 hover:border-indigo-300 text-slate-600'
                                }`}
                        >
                            <Package className="w-6 h-6" />
                            <span>Other</span>
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        {type === 'vehicle' ? 'Vehicle Make & Model' : type === 'property' ? 'Property Name / Address' : 'Asset Name'}
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={type === 'vehicle' ? "e.g. Honda City" : "e.g. My Apartment"}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {type === 'vehicle' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Registration Number</label>
                        <input
                            type="text"
                            value={registration}
                            onChange={e => setRegistration(e.target.value)}
                            placeholder="e.g. MH 01 AB 1234"
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Value (₹) - Optional</label>
                    <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="e.g. 500000"
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSaving || !name}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Add Asset'}
                </button>
            </form>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
