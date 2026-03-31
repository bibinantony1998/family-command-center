export type RootStackParamList = {
    Auth: undefined;
    JoinFamily: undefined;
    Main: undefined;
    Profile: undefined;
    Dashboard: undefined;
    OnboardingJoinFamily: undefined;

    // Games
    Game_ColorChaos: undefined;
    Game_MemoryMatch: undefined;
    Game_NumberMemory: undefined;
    Game_PatternMemory: undefined;
    Game_QuickMath: undefined;
    Game_ReflexChallenge: undefined;
    Game_SchulteTable: undefined;
    Game_SimonSays: undefined;
    Game_TowerOfHanoi: undefined;
    Game_WaterJugs: undefined;
    Game_WhackAMole: undefined;
    Game_WordScramble: undefined;
    Game_BallSort: undefined;
    Game_NBack: undefined;
    Game_MentalRotation: undefined;
    Game_NumberSequence: undefined;
    Game_PathwayMaze: undefined;
    Game_DualTask: undefined;
    Game_VisualSearch: undefined;
    Game_AnagramSolver: undefined;
    Game_TrailMaking: undefined;
    // New games
    Game_Sudoku: undefined;
    Game_TypingSpeed: undefined;
    Game_Hangman: undefined;
    Game_WordConnections: undefined;
    Game_CodeBreaker: undefined;
    Game_2048: undefined;
    Game_LightsOut: undefined;
    Game_WordChain: undefined;
    // New problem solving games
    Game_SlidingPuzzle: undefined;
    Game_RiverCrossing: undefined;
    Game_MatchstickMath: undefined;
    // Expenses
    AddExpense: { id?: string } | undefined;
    SettleUp: undefined;
    ExpenseReports: undefined;
    Chat: { recipientId: string | null; name: string };
    VideoCall: { recipientId: string; name: string; isCaller: boolean; offer?: any };
    // Bills & Payments
    Bills: undefined;
    AddBill: { category?: string } | undefined;
    // Insurance
    Insurance: undefined;
    AddPolicy: { category?: string } | undefined;
    // Assets
    Assets: undefined;
    AddAsset: undefined;
};


export type AuthStackParamList = {
    Login: undefined;
    Register: { isKid?: boolean };
    JoinFamily: undefined;
};

export type MainTabParamList = {
    Dashboard: undefined;
    Chores: undefined;
    ChatList: undefined;
    Rewards: undefined;
    Groceries: undefined;
    Notes: undefined;
    Games: undefined;
    Menu: undefined;
    Split: undefined;
};
