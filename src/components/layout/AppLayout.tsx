import { Outlet, NavLink } from 'react-router-dom';
import { Home, ShoppingCart, StickyNote, CheckCircle, User, Gamepad2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function AppLayout() {
    return (
        <div className="flex h-[100dvh] flex-col bg-slate-50">
            <main className="flex-1 overflow-y-auto pb-24">
                <div className="mx-auto max-w-md p-4">
                    <Outlet />
                </div>
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-6 pb-6 pt-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="mx-auto flex max-w-md justify-between">
                    <NavItem to="/" icon={<Home size={24} />} label="Home" />
                    <NavItem to="/groceries" icon={<ShoppingCart size={24} />} label="Shop" />
                    <NavItem to="/notes" icon={<StickyNote size={24} />} label="Notes" />
                    <NavItem to="/chores" icon={<CheckCircle size={24} />} label="Chores" />
                    <NavItem to="/games" icon={<Gamepad2 size={24} />} label="Games" />
                    <NavItem to="/profile" icon={<User size={24} />} label="Profile" />
                </div>
            </nav>
        </div>
    );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    'flex flex-col items-center gap-1 transition-colors',
                    isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                )
            }
        >
            {icon}
            <span className="text-xs font-medium">{label}</span>
        </NavLink>
    );
}
