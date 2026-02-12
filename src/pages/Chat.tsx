import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { ChatList } from '../components/chat/ChatList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePresence } from '../hooks/usePresence';

export default function Chat() {
    const { profile, family } = useAuth(); // Destructure family
    const navigate = useNavigate();

    // activeChatId: null = List View, 'GROUP' = Group, 'uuid' = DM
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [otherParents, setOtherParents] = useState<Profile[]>([]);

    const familyId = family?.id || profile?.family_id || '';
    const { isUserOnline } = usePresence(familyId || null, profile?.id || null);

    useEffect(() => {
        if (profile?.role !== 'parent') {
            navigate('/');
        }
    }, [profile, navigate]);

    useEffect(() => {
        const fId = family?.id || profile?.family_id;

        if (!profile || !fId) {
            return;
        }

        const fetchFamilyMembers = async () => {
            // 1. Get ALL members in the family via family_members JOIN
            // This ensures we get everyone in THIS family, even if they are in others.
            const { data: members, error } = await supabase
                .from('family_members')
                .select('role, profile:profiles(*)')
                .eq('family_id', fId);

            if (error) {
                console.error("Error fetching family members:", error);
                return;
            }

            if (!members || members.length === 0) {
                setOtherParents([]);
                return;
            }

            // Map to profile objects, using the ROLE from family_members
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allProfiles = members.map((m: any) => ({
                ...m.profile,
                role: m.role // Use the specific family role (e.g. parent/child)
            })).filter(p => p && p.id);

            // 2. Filter for parents/adults (Exclude children and self)
            const parentMembers = allProfiles.filter(p =>
                p.role !== 'child' &&
                p.id !== profile.id
            );

            setOtherParents(parentMembers);

        };

        fetchFamilyMembers();
    }, [profile, family]);

    const handleBackToList = () => {
        setActiveChatId(null);
    };

    if (!profile) return null;

    if (activeChatId !== null) {
        // CHAT DETAIL VIEW (Fixed Full Screen)
        const recipientIdForWindow = activeChatId === 'GROUP' ? null : activeChatId;
        const chatTitle = activeChatId === 'GROUP' ? 'Family Board' : otherParents.find(p => p.id === activeChatId)?.display_name || 'Chat';
        const isDM = activeChatId !== 'GROUP';
        const recipientOnline = isDM ? isUserOnline(activeChatId) : false;

        return (
            <div className="fixed inset-0 z-[49] bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)]">
                {/* Fixed Header */}
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center shadow-sm shrink-0">
                    <button onClick={handleBackToList} className="p-2 -ml-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex flex-col">
                        <h2 className="font-bold text-lg text-slate-800 leading-tight">{chatTitle}</h2>
                        {isDM && (
                            <span className={`text-xs flex items-center gap-1 ${recipientOnline ? 'text-green-500' : 'text-slate-400'}`}>
                                <span className={`inline-block w-2 h-2 rounded-full ${recipientOnline ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                {recipientOnline ? 'Online' : 'Offline'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Chat Window takes remaining space */}
                <div className="flex-1 overflow-hidden relative">
                    <ChatWindow
                        key={activeChatId}
                        recipientId={recipientIdForWindow}
                        currentProfile={profile}
                        familyId={familyId}
                        isRecipientOnline={recipientOnline}
                    />
                </div>
            </div>
        );
    }

    // LIST VIEW (Standard Page Layout)
    return (
        <div className="space-y-6 pb-20">
            <header>
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="text-indigo-600" /> Messages
                </h1>
                <p className="text-slate-500 font-medium">Chat with family</p>
                {/* Fallback warning if family ID is missing in context but profile loaded */}
                {!familyId && (
                    <p className="text-red-500 text-xs">Warning: Family Context Missing. Re-login suggested.</p>
                )}
            </header>

            <ChatList
                otherParents={otherParents}
                selectedRecipientId={null}
                onSelectChat={(id) => setActiveChatId(id === null ? 'GROUP' : id)}
                familyId={familyId}
                currentUserId={profile.id}
            />
        </div>
    );
}
