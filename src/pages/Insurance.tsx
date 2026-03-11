import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchInsurancePolicies } from '../lib/api/assets';
import type { InsurancePolicy } from '../types';
import { Shield, ShieldAlert, ShieldCheck, Plus, HeartPulse, Heart, Car, Home } from 'lucide-react';

/*
const INSURANCE_ICONS: Record<string, React.ReactNode> = {
    health: <HeartPulse className="w-5 h-5 text-rose-500" />,
    life: <Heart className="w-5 h-5 text-red-500" />,
    vehicle: <Car className="w-5 h-5 text-blue-500" />,
    property: <Home className="w-5 h-5 text-indigo-500" />,
    medical: <Stethoscope className="w-5 h-5 text-teal-500" />,
};
*/

export default function Insurance() {
    const navigate = useNavigate();
    const { profile, currentFamily } = useAuth();
    const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPolicies = async () => {
            try {
                const data = await fetchInsurancePolicies(currentFamily!.id);
                setPolicies(data);
            } catch (error) {
                console.error('Error loading policies:', error);
            } finally {
                setLoading(false);
            }
        };

        if (!currentFamily?.id || profile?.role !== 'parent') {
            setLoading(false);
            return;
        }
        loadPolicies();
    }, [currentFamily, profile?.role]);

    if (profile?.role !== 'parent') {
        return (
            <div className="p-8 text-center max-w-lg mx-auto mt-20 bg-white rounded-2xl shadow-sm border border-slate-100">
                <ShieldAlert className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
                <p className="text-slate-500">Only parents can view and manage family insurance policies.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Health & Insurance</h1>
                    <p className="text-slate-500 mt-1">Manage family health, life, and asset insurance policies</p>
                </div>
            </div>

            {/* Insurance Categories Grid */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-8">
                <h2 className="text-lg font-bold text-slate-800 mb-4">Insurance Categories</h2>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-4">
                    {[
                        { id: 'health', label: 'Health', icon: <HeartPulse className="w-6 h-6 text-rose-500" /> },
                        { id: 'life', label: 'Life', icon: <Heart className="w-6 h-6 text-red-500" /> },
                        { id: 'vehicle', label: 'Vehicle', icon: <Car className="w-6 h-6 text-blue-500" /> },
                        { id: 'property', label: 'Property', icon: <Home className="w-6 h-6 text-indigo-500" /> }
                    ].map((service) => (
                        <button
                            key={service.id}
                            onClick={() => navigate(`/insurance/add?category=${service.id}`)}
                            className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors group"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:shadow-sm transition-all">
                                {service.icon}
                            </div>
                            <span className="text-sm font-medium text-slate-700 text-center leading-tight">
                                {service.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <ShieldCheck className="w-24 h-24 text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Active Policies</p>
                    <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-900">{policies.length}</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : policies.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 mb-4">
                        <Shield className="w-10 h-10 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No insurance policies found</h3>
                    <p className="text-slate-500 mb-6 max-w-sm mx-auto">Keep track of your family's health, life, and asset covers in one secure place.</p>
                    <button
                        onClick={() => navigate('/insurance/add')}
                        className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Your First Policy</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Policy list will go here */}
                </div>
            )}
        </div>
    );
}
