export type RootStackParamList = {
    Auth: undefined;
    JoinFamily: undefined;
    Main: undefined;
    Profile: undefined;
    Dashboard: undefined;

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
};

export type AuthStackParamList = {
    Login: undefined;
    Register: { isKid?: boolean };
    JoinFamily: undefined;
};

export type MainTabParamList = {
    Dashboard: undefined;
    Chores: undefined;
    Rewards: undefined;
    Groceries: undefined;
    Notes: undefined;
    Games: undefined;
};
