import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export const GiftBoxIcon = ({ size = 64 }: { size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 512 512">
        <Defs>
            <LinearGradient id="boxGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#a78bfa" />
                <Stop offset="1" stopColor="#7c3aed" />
            </LinearGradient>
            <LinearGradient id="ribbonGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#fde047" />
                <Stop offset="1" stopColor="#fbbf24" />
            </LinearGradient>
        </Defs>

        {/* Box Body */}
        <Path
            d="M80 160h352v288a32 32 0 0 1-32 32H112a32 32 0 0 1-32-32V160z"
            fill="url(#boxGrad)"
        />

        {/* Box Lid */}
        <Path
            d="M48 112h416a16 16 0 0 1 16 16v32H32v-32a16 16 0 0 1 16-16z"
            fill="#8b5cf6"
        />
        <Path
            d="M48 112h416a16 16 0 0 1 16 16v16H32v-16a16 16 0 0 1 16-16z"
            fill="#a78bfa"
        />

        {/* Vertical Ribbon */}
        <Path
            d="M232 160h48v320h-48z"
            fill="url(#ribbonGrad)"
        />
        <Path
            d="M232 112h48v48h-48z"
            fill="#fbbf24"
        />

        {/* Bow Left Loop */}
        <Path
            d="M256 128c-30-50-90-50-90 10s50 60 90 20z"
            fill="#fde047"
        />
        <Path
            d="M256 128c-30-50-90-50-90 10c0 5 2 10 5 13c-15-40 25-60 85-23z"
            fill="#fbbf24"
        />

        {/* Bow Right Loop */}
        <Path
            d="M256 128c30-50 90-50 90 10s-50 60-90 20z"
            fill="#fde047"
        />
        <Path
            d="M256 128c30-50 90-50 90 10c0 5-2 10-5 13c15-40-25-60-85-23z"
            fill="#fbbf24"
        />

        {/* Center Knot */}
        <Path
            d="M236 118a16 16 0 0 1 40 0a16 16 0 0 1-40 0z"
            fill="#f59e0b"
        />
    </Svg>
);
