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
    // Expenses
    AddExpense: { id?: string } | undefined;
    SettleUp: undefined;
    ExpenseReports: undefined;
    Chat: { recipientId: string | null; name: string };
    VideoCall: { recipientId: string; name: string; isCaller: boolean; offer?: any };
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
