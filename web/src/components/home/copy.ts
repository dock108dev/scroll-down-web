export const HOME_COPY = {
  openGameHint: "Catch up in order",
  revealScore: "Reveal score",
  revealAllScores: "Reveal scores",
  revealHero: {
    default: {
      lead: "Scores are hidden by default.",
      body: "Tap a matchup to catch up in order, or reveal the score when you want the result.",
    },
    blacklistWithRules: {
      lead: "Selected scores are hidden.",
      body: "Teams and leagues on your hide list stay hidden. Tap a matchup to catch up in order.",
    },
    blacklistEmpty: {
      lead: "Scores are visible by default.",
      body: "Add teams or leagues in Score visibility to hide only the ones you care about.",
    },
  },
  onboarding: [
    "Tap a matchup to catch up in order. Use Reveal score when you want the result.",
    "Your reveals are saved. Come back anytime and keep scores hidden until you choose.",
  ],
  unavailableFeatures: {
    hiddenScores: "Hidden scores - reveal the result when you are ready",
    timelines: "Game stories that unfold in order",
  },
} as const;
