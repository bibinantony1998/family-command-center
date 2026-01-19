import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { ChatList } from '../components/chat/ChatList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ArrowLeft, MessageSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
    const { profile, family } = useAuth(); // Destructure family
    const navigate = useNavigate();

    // activeChatId: null = List View, 'GROUP' = Group, 'uuid' = DM
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [otherParents, setOtherParents] = useState<Profile[]>([]);

    // Debug state
    const [debugInfo, setDebugInfo] = useState<string>('Initializing...');

    useEffect(() => {
        if (profile?.role !== 'parent') {
            navigate('/');
        }
    }, [profile, navigate]);

    useEffect(() => {
        const familyId = family?.id || profile?.family_id;

        if (!profile || !familyId) {
            setDebugInfo("No profile or family ID loaded.");
            return;
        }

        const fetchFamilyMembers = async () => {
            // 1. Get ALL members in the family via family_members JOIN
            // This ensures we get everyone in THIS family, even if they are in others.
            const { data: members, error } = await supabase
                .from('family_members')
                .select('role, profile:profiles(*)')
                .eq('family_id', familyId);

            if (error) {
                console.error("Error fetching family members:", error);
                setDebugInfo(`Error: ${error.message}`);
                return;
            }

            if (!members || members.length === 0) {
                setOtherParents([]);
                setDebugInfo('No members found in this family.');
                return;
            }

            // Map to profile objects, using the ROLE from family_members
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

            // 3. SET RICH DEBUG INFO
            const summary = allProfiles.map(p => `${p.display_name} [${p.role}]`).join('\n');
            setDebugInfo(`Using Family ID: ${familyId}\nFetched ${allProfiles.length} members.\nFiltered to ${parentMembers.length} parents.\n\nRaw Member List:\n${summary}`);
        };

        fetchFamilyMembers();
    }, [profile, family]);

    const handleBackToList = () => {
        setActiveChatId(null);
    };

    if (!profile) return null;

    // View Logic
    const familyId = family?.id || profile.family_id || '';

    if (activeChatId !== null) {
        // CHAT DETAIL VIEW (Fixed Full Screen)
        const recipientIdForWindow = activeChatId === 'GROUP' ? null : activeChatId;
        const chatTitle = activeChatId === 'GROUP' ? 'Family Board' : otherParents.find(p => p.id === activeChatId)?.display_name || 'Chat';

        return (
            <div className="fixed inset-0 z-[49] bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)]">
                {/* Fixed Header */}
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center shadow-sm shrink-0">
                    <button onClick={handleBackToList} className="p-2 -ml-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="font-bold text-lg text-slate-800">{chatTitle}</h2>
                </div>

                {/* Chat Window takes remaining space */}
                <div className="flex-1 overflow-hidden relative">
                    <ChatWindow
                        key={activeChatId}
                        recipientId={recipientIdForWindow}
                        currentProfile={profile}
                        familyId={familyId}
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

            {/* DEBUG PANEL - Hide if working */}
            {otherParents.length === 0 && (
                <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 overflow-x-auto">
                    <div className="flex items-center gap-2 mb-2 font-bold text-amber-600">
                        <AlertTriangle size={14} /> DEBUG CONSOLE (No Parents Found)
                    </div>
                    <div className="space-y-1">
                        <p><strong>My ID:</strong> {profile.id}</p>
                        <p><strong>My Role:</strong> {profile.role}</p>
                        <p><strong>Family ID (Context):</strong> {family?.id || 'Missing'}</p>
                        <p><strong>Family ID (Profile):</strong> {profile.family_id || 'Missing'}</p>
                        <div className="border-t border-slate-300 my-2 pt-2 whitespace-pre-wrap">
                            {debugInfo}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
