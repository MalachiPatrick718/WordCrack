export type HowToPlaySlide = { title: string; body: string; emoji: string };

export const HOW_TO_PLAY_SLIDES: HowToPlaySlide[] = [
  {
    emoji: "🧩",
    title: "Goal",
    body: "Crack the 5‑letter word as fast as possible. Everyone gets the same puzzle for the current timer window.",
  },
  {
    emoji: "👤",
    title: "Guest Mode",
    body: "No account required to play. Use Guest Mode if you want to let friends try WordCrack—upgrade later to save progress across devices.",
  },
  {
    emoji: "🔤",
    title: "Ciphered Word",
    body: "You’ll see a cipher word. It’s created from the hidden target using one shift amount (some positions may be unshifted).",
  },
  {
    emoji: "🎛️",
    title: "Choose Letters",
    body: "There are 5 columns. Each column has 5 letters. Use ▲/▼ to cycle and build your guess.",
  },
  {
    emoji: "▶️",
    title: "Start & Pause",
    body: "Tap Start to begin the timer. You can pause/resume—letters lock while paused.",
  },
  {
    emoji: "💡",
    title: "Hints",
    body: "Up to 3 hints total. Each hint adds a time penalty. Shift Amount reveals the amount (not direction).",
  },
  {
    emoji: "⏱️",
    title: "Scoring",
    body: "Final time = solve time + penalties. Faster is better.",
  },
  {
    emoji: "🏆",
    title: "Leaderboards",
    body: "Daily puzzles are leaderboard‑eligible. Practice puzzles help you build skill + speed and never count toward leaderboards.",
  },
  {
    emoji: "⭐",
    title: "Premium",
    body: "Premium unlocks unlimited practice puzzles, friends, and advanced stats.",
  },
];

