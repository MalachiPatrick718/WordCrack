export type HowToPlaySlide = { title: string; body: string; emoji: string };

export const HOW_TO_PLAY_SLIDES: HowToPlaySlide[] = [
  {
    emoji: "🧩",
    title: "Crack the Word",
    body: "New puzzles every hour—everyone gets the same challenge. Cipher puzzles are 5 letters. Scramble puzzles are 6 letters.",
  },
  {
    emoji: "🔐",
    title: "Cipher Puzzle",
    body: "Letters are shifted by the same amount (A-Z wraps). Use the theme hint to crack the code!",
  },
  {
    emoji: "🔀",
    title: "Scramble Puzzle",
    body: "A 6-letter word is jumbled up. Rearrange the letters to spell the correct word.",
  },
  {
    emoji: "🎮",
    title: "How to Play",
    body: "Use ▲/▼ to cycle letters in each column (5 columns in Cipher, 6 columns in Scramble). Use hints if stuck (adds time penalty). Tap Start when ready!",
  },
  {
    emoji: "🏆",
    title: "Compete & Win",
    body: "Race for the fastest time on daily leaderboards. Practice puzzles reset daily (5 per type).",
  },
];

