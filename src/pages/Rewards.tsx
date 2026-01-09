import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Trophy, Plus, Trash2, Check, X, Clock } from 'lucide-react';
import type { Reward, Redemption } from '../types';
import confetti from 'canvas-confetti';

export default function Rewards() {
    const { profile } = useAuth();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [redemptions, setRedemptions] = useState<Redemption[]>([]);
    const [balance, setBalance] = useState(0);

    // Parent Inputs
    const [newRewardName, setNewRewardName] = useState('');
    const [newRewardCost, setNewRewardCost] = useState('');

    const isParent = profile?.role === 'parent';

    const fetchData = useCallback(async () => {
        if (!profile?.family_id) return;

        // Fetch Rewards Catalog
        const { data: rewardsData } = await supabase
            .from('rewards')
            .select('*')
            .eq('family_id', profile.family_id)
            .order('cost', { ascending: true });

        if (rewardsData) setRewards(rewardsData);

        // Fetch Redemptions
        let query = supabase
            .from('redemptions')
            .select(`
                *,
                rewards (*),
                profiles:kid_id (display_name)
            `)
            .eq('family_id', profile.family_id)
            .order('created_at', { ascending: false });

        // If child, only see own? 
        // Plan says: "Kid: View Redemption Status". Parents "View All"
        if (!isParent) {
            query = query.eq('kid_id', profile.id);
        }

        const { data: redemptionsData } = await query;
        // Need to cast because Supabase join types are tricky
        if (redemptionsData) setRedemptions(redemptionsData as any);

        // Fetch Balance (Kids only)
        if (!isParent) {
            const { data: profileData } = await supabase.from('profiles').select('balance').eq('id', profile.id).single();
            if (profileData) setBalance(profileData.balance || 0);
        }
    }, [profile, isParent]);

    useEffect(() => {
        fetchData();

        // Subscription would go here for real-time updates
    }, [fetchData]);

    const handleAddReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRewardName || !newRewardCost || !profile?.family_id) return;

        const { error } = await supabase.from('rewards').insert({
            family_id: profile.family_id,
            name: newRewardName,
            cost: parseInt(newRewardCost),
            icon: '🎁' // Default icon for now
        });

        if (!error) {
            setNewRewardName('');
            setNewRewardCost('');
            fetchData();
        }
    };

    const handleDeleteReward = async (id: string) => {
        if (!confirm('Delete this reward?')) return;
        await supabase.from('rewards').delete().eq('id', id);
        fetchData();
    };

    const handleRedeem = async (reward: Reward) => {
        if (!profile || isParent) return;

        // Check Balance
        if (balance < reward.cost) {
            alert("Not enough points!");
            return;
        }

        // Use RPC to Request Redemption (Deducts points atomically)
        const { data, error } = await supabase.rpc('request_redemption', { reward_id_param: reward.id });

        if (error || (data && data.error)) {
            console.error(error || data?.error);
            alert('Error: ' + (error?.message || data?.error));
        } else {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            fetchData();
        }
    };

    const handleUpdateStatus = async (redemptionId: string, status: 'approved' | 'rejected') => {
        if (!isParent) return;

        let error;
        if (status === 'approved') {
            const { error: rpcError } = await supabase.rpc('approve_redemption', { redemption_id_param: redemptionId });
            error = rpcError;
        } else {
            const { error: rpcError } = await supabase.rpc('reject_redemption', { redemption_id_param: redemptionId });
            error = rpcError;
        }

        if (!error) {
            if (status === 'approved') {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
            fetchData();
        } else {
            console.error(error);
            alert('Action failed');
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <header>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <Trophy className="text-yellow-500" /> Rewards
                        </h1>
                        <p className="text-slate-500">
                            {isParent ? 'Manage rewards and requests' : 'Redeem your hard-earned points!'}
                        </p>
                    </div>
                    {!isParent && (
                        <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl border border-yellow-200">
                            <p className="text-xs uppercase font-bold opacity-70">Your Balance</p>
                            <p className="text-2xl font-bold">{balance} <span className="text-sm">pts</span></p>
                        </div>
                    )}
                </div>
            </header>

            {/* Parent: Add Reward */}
            {isParent && (
                <Card className="p-4 bg-indigo-50 border-indigo-100">
                    <h3 className="font-semibold text-indigo-900 mb-3">Add New Reward</h3>
                    <form onSubmit={handleAddReward} className="flex gap-2">
                        <Input
                            placeholder="Reward Name (e.g. Ice Cream)"
                            value={newRewardName}
                            onChange={e => setNewRewardName(e.target.value)}
                            className="flex-1"
                        />
                        <Input
                            type="number"
                            placeholder="Cost"
                            value={newRewardCost}
                            onChange={e => setNewRewardCost(e.target.value)}
                            className="w-24"
                        />
                        <Button type="submit"><Plus size={20} /></Button>
                    </form>
                </Card>
            )}

            {/* Rewards Catalog */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-3">Available Rewards</h2>
                <div className="grid grid-cols-2 gap-4">
                    {rewards.map(reward => (
                        <Card key={reward.id} className="relative p-4 flex flex-col items-center text-center gap-2 border-slate-200">
                            <div className="text-4xl mb-1">{reward.icon}</div>
                            <h3 className="font-bold text-slate-800 leading-tight">{reward.name}</h3>
                            <div className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-full text-sm">
                                {reward.cost} pts
                            </div>

                            {isParent ? (
                                <button
                                    onClick={() => handleDeleteReward(reward.id)}
                                    className="absolute top-2 right-2 text-slate-300 hover:text-red-400"
                                >
                                    <Trash2 size={16} />
                                </button>
                            ) : (
                                <Button
                                    onClick={() => handleRedeem(reward)}
                                    variant={balance >= reward.cost ? "primary" : "secondary"}
                                    disabled={balance < reward.cost}
                                    className={`w-full mt-2 h-8 text-sm ${balance < reward.cost ? 'opacity-50' : ''}`}
                                >
                                    {balance < reward.cost ? 'Need more pts' : 'Redeem'}
                                </Button>
                            )}
                        </Card>
                    ))}
                    {rewards.length === 0 && (
                        <p className="col-span-2 text-center text-slate-400 italic py-8">
                            No rewards added yet.
                        </p>
                    )}
                </div>
            </section>

            {/* Redemptions List */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-3">
                    {isParent ? 'Redemption Requests' : 'My Requests'}
                </h2>
                <div className="space-y-3">
                    {redemptions.map(r => (
                        <div key={r.id} className="bg-white border boundary-slate-200 rounded-xl p-3 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                                    r.status === 'approved' ? 'bg-green-100 text-green-600' :
                                        'bg-red-100 text-red-600'
                                    }`}>
                                    {r.status === 'pending' ? <Clock size={20} /> :
                                        r.status === 'approved' ? <Check size={20} /> :
                                            <X size={20} />}
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800">
                                        {r.rewards?.name || 'Unknown Reward'}
                                        {isParent && <span className="font-normal text-slate-500"> • {r.profiles?.display_name}</span>}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {new Date(r.created_at || '').toLocaleDateString()} • {r.rewards?.cost} pts
                                    </p>
                                </div>
                            </div>

                            {isParent && r.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdateStatus(r.id, 'rejected')}
                                        className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(r.id, 'approved')}
                                        className="p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            )}

                            {!isParent && (
                                <span className={`text-xs font-bold uppercase ${r.status === 'pending' ? 'text-yellow-600' :
                                    r.status === 'approved' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {r.status}
                                </span>
                            )}
                        </div>
                    ))}
                    {redemptions.length === 0 && (
                        <p className="text-center text-slate-400 italic py-4">No requests found.</p>
                    )}
                </div>
            </section>
        </div>
    );
}
