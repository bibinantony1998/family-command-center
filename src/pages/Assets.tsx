import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchAssets } from '../lib/api/assets';
import type { Asset } from '../types';
import { Car, Home, Plus } from 'lucide-react';

/*
const ASSET_ICONS: Record<string, React.ReactNode> = {
    vehicle: <Car className="w-5 h-5 text-blue-500" />,
    property: <Home className="w-5 h-5 text-indigo-500" />,
    other: <Package className="w-5 h-5 text-slate-500" />
};
*/

export default function Assets() {
    const navigate = useNavigate();
    const { profile, currentFamily } = useAuth();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAssets = async () => {
            try {
                const data = await fetchAssets(currentFamily!.id);
                setAssets(data);
            } catch (error) {
                console.error('Error loading assets:', error);
            } finally {
                setLoading(false);
            }
        };

        if (!currentFamily?.id || profile?.role !== 'parent') {
            setLoading(false);
            return;
        }
        loadAssets();
    }, [currentFamily, profile?.role]);

    if (profile?.role !== 'parent') {
        return (
            <div className="p-8 text-center max-w-lg mx-auto mt-20 bg-white rounded-2xl shadow-sm border border-slate-100">
                <Home className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
                <p className="text-slate-500">Only parents can view and manage family assets.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Family Assets</h1>
                    <p className="text-slate-500 mt-1">Manage vehicles, properties, and important family assets</p>
                </div>
                <button
                    onClick={() => navigate('/assets/add')}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add Asset</span>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : assets.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 mb-4">
                        <Car className="w-10 h-10 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No assets added yet</h3>
                    <p className="text-slate-500 mb-6 max-w-sm mx-auto">Add your family's vehicles, properties, and other valuable assets to keep track of them and their insurance.</p>
                    <button
                        onClick={() => navigate('/assets/add')}
                        className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Your First Asset</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assets.map(asset => {
                        const details = asset.details as Record<string, string>;
                        const name = details?.name || details?.registration_number || `${asset.type} asset`;
                        const subtitle = asset.type === 'vehicle'
                            ? [details?.make, details?.model, details?.year].filter(Boolean).join(' ')
                            : asset.type === 'property'
                                ? details?.address || details?.location || ''
                                : details?.description || '';
                        const reg = details?.registration_number || details?.reg_number || '';

                        return (
                            <div key={asset.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${asset.type === 'vehicle' ? 'bg-blue-50' : asset.type === 'property' ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                                        {asset.type === 'vehicle'
                                            ? <Car className="w-6 h-6 text-blue-500" />
                                            : <Home className="w-6 h-6 text-indigo-500" />}
                                    </div>
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${asset.type === 'vehicle' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {asset.type}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 text-base leading-tight">{name}</h3>
                                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                                {reg && (
                                    <p className="text-xs font-mono text-slate-400 mt-2 bg-slate-50 px-2 py-1 rounded-lg inline-block">{reg}</p>
                                )}
                                <p className="text-xs text-slate-400 mt-3">Added {new Date(asset.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
