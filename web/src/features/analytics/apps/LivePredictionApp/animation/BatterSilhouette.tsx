"use client";

interface BatterSilhouetteProps {
  swinging: boolean;
}

export function BatterSilhouette({ swinging }: BatterSilhouetteProps) {
  return (
    <g>
      {/* Shadow */}
      <ellipse cx="270" cy="115" rx="10" ry="4" fill="#404040" opacity="0.3" />
      {/* Legs */}
      <line
        x1="266"
        y1="105"
        x2="262"
        y2="115"
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="274"
        y1="105"
        x2="278"
        y2="115"
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Torso */}
      <line
        x1="270"
        y1="85"
        x2="270"
        y2="105"
        stroke="#d4d4d4"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Head + helmet */}
      <circle cx="270" cy="78" r="7" fill="#d4d4d4" />
      <path
        d="M264 76 Q264 72 270 72 Q276 72 276 76"
        fill="#a3a3a3"
        stroke="none"
      />
      {/* Arms */}
      <line
        x1="270"
        y1="88"
        x2="260"
        y2="82"
        stroke="#d4d4d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Bat */}
      <line
        x1="260"
        y1="82"
        x2={swinging ? "285" : "255"}
        y2={swinging ? "95" : "65"}
        stroke="#a3a3a3"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: "all 120ms ease-in", transformOrigin: "260px 82px" }}
      />
    </g>
  );
}
