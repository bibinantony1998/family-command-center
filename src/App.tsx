import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import { AppLayout } from './components/layout/AppLayout';
import Auth from './pages/Auth';
import JoinFamily from './pages/JoinFamily';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';

import Groceries from './pages/Groceries';
import Notes from './pages/Notes';
import Chores from './pages/Chores';
import Games from './pages/Games';
import QuickMath from './pages/games/QuickMath';
import MemoryMatch from './pages/games/MemoryMatch';
import WaterJugs from './pages/games/WaterJugs';
import TowerOfHanoi from './pages/games/TowerOfHanoi';
import SimonSays from './pages/games/SimonSays';
import ColorChaos from './pages/games/ColorChaos';
import WordScramble from './pages/games/WordScramble';
import ReflexChallenge from './pages/games/ReflexChallenge';
import PatternMemory from './pages/games/PatternMemory';
import SchulteTable from './pages/games/SchulteTable';
import NumberMemory from './pages/games/NumberMemory';
import WhackAMole from './pages/games/WhackAMole';
import BallSort from './pages/games/BallSort';
import NBack from './pages/games/NBack';
import MentalRotation from './pages/games/MentalRotation';
import PathwayMaze from './pages/games/PathwayMaze';
import NumberSequence from './pages/games/NumberSequence';
import DualTask from './pages/games/DualTask';
import VisualSearch from './pages/games/VisualSearch';
import AnagramSolver from './pages/games/AnagramSolver';
import TrailMaking from './pages/games/TrailMaking';
import Sudoku from './pages/games/Sudoku';
import TypingSpeed from './pages/games/TypingSpeed';
import Hangman from './pages/games/Hangman';
import WordConnections from './pages/games/WordConnections';
import CodeBreaker from './pages/games/CodeBreaker';
import Game2048 from './pages/games/Game2048';
import LightsOut from './pages/games/LightsOut';
import WordChain from './pages/games/WordChain';
import SlidingPuzzle from './pages/games/SlidingPuzzle';
import RiverCrossing from './pages/games/RiverCrossing';
import MatchstickMath from './pages/games/MatchstickMath';
import Profile from './pages/Profile';
import Rewards from './pages/Rewards';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import SettleUp from './pages/SettleUp';
import ExpenseReports from './pages/ExpenseReports';
import BillsDashboard from './pages/BillsDashboard';
import AddBill from './pages/AddBill';
import Assets from './pages/Assets';
import AddAsset from './pages/AddAsset';
import Insurance from './pages/Insurance';
import AddPolicy from './pages/AddPolicy';
export default function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <AuthenticatedAppContent />
      </CallProvider>
    </AuthProvider>
  );
}

function AuthenticatedAppContent() {
  const { profile, loading: authLoading, myFamilies } = useAuth();

  if (authLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  // If user is authenticated but not in any family, only allow JoinFamily page
  if (profile && (!myFamilies || myFamilies.length === 0)) {
    return (
      <Routes>
        <Route path="*" element={<JoinFamily />} />
      </Routes>
    );
  }

  // If user has families but no active family context (e.g. just left one), redirect to profile to pick one
  // But we must allow the /profile route itself to work!
  // The AppLayout handles the sidebar/redirects usually. Let's let the main Routes handle it,
  // but if we are at root /, we might want to redirect.
  // Actually, if we just let it fall through to main Routes:
  // - / -> Dashboard -> might crash if family is null?
  // - /profile -> Profile -> Works.

  // Let's just fix the blocking check first.

  return (
    <Routes>
      <Route path="/auth" element={!profile ? <Auth /> : <Navigate to="/" />} />
      <Route path="/" element={profile ? <AppLayout /> : <Navigate to="/auth" />}>
        <Route index element={<Dashboard />} />
        <Route path="groceries" element={<Groceries />} />
        <Route path="notes" element={<Notes />} />
        <Route path="chores" element={<Chores />} />
        <Route path="games" element={<Games />} />
        <Route path="games/quick-math" element={<QuickMath />} />
        <Route path="games/memory-match" element={<MemoryMatch />} />
        <Route path="games/water-jugs" element={<WaterJugs />} />
        <Route path="games/tower-hanoi" element={<TowerOfHanoi />} />
        <Route path="games/simon-says" element={<SimonSays />} />
        <Route path="games/color-chaos" element={<ColorChaos />} />
        <Route path="games/word-scramble" element={<WordScramble />} />
        <Route path="games/reflex-challenge" element={<ReflexChallenge />} />
        <Route path="games/pattern-memory" element={<PatternMemory />} />
        <Route path="games/schulte-table" element={<SchulteTable />} />
        <Route path="games/number-memory" element={<NumberMemory />} />
        <Route path="games/whack-a-mole" element={<WhackAMole />} />
        <Route path="games/ball-sort" element={<BallSort />} />
        <Route path="games/n-back" element={<NBack />} />
        <Route path="games/mental-rotation" element={<MentalRotation />} />
        <Route path="games/pathway-maze" element={<PathwayMaze />} />
        <Route path="games/number-sequence" element={<NumberSequence />} />
        <Route path="games/dual-task" element={<DualTask />} />
        <Route path="games/visual-search" element={<VisualSearch />} />
        <Route path="games/anagram-solver" element={<AnagramSolver />} />
        <Route path="games/trail-making" element={<TrailMaking />} />
        <Route path="games/sudoku" element={<Sudoku />} />
        <Route path="games/typing-speed" element={<TypingSpeed />} />
        <Route path="games/hangman" element={<Hangman />} />
        <Route path="games/word-connections" element={<WordConnections />} />
        <Route path="games/code-breaker" element={<CodeBreaker />} />
        <Route path="games/2048" element={<Game2048 />} />
        <Route path="games/lights-out" element={<LightsOut />} />
        <Route path="games/word-chain" element={<WordChain />} />
        <Route path="games/sliding-puzzle" element={<SlidingPuzzle />} />
        <Route path="games/river-crossing" element={<RiverCrossing />} />
        <Route path="games/matchstick-math" element={<MatchstickMath />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="profile" element={<Profile />} />
        <Route path="chat" element={<Chat />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/add" element={<AddExpense />} />
        <Route path="expenses/settle" element={<SettleUp />} />
        <Route path="expenses/reports" element={<ExpenseReports />} />
        <Route path="bills" element={<BillsDashboard />} />
        <Route path="bills/add" element={<AddBill />} />
        <Route path="assets" element={<Assets />} />
        <Route path="assets/add" element={<AddAsset />} />
        <Route path="insurance" element={<Insurance />} />
        <Route path="insurance/add" element={<AddPolicy />} />
        <Route path="join-family" element={<JoinFamily />} />
      </Route>
    </Routes>
  );
}
