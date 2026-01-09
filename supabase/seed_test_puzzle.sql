-- Seed a proper test puzzle for WordCrack
-- This creates a cipher puzzle for today's date

-- Delete existing puzzle for today (if any)
DELETE FROM public.puzzles WHERE puzzle_date = CURRENT_DATE;

-- Insert a proper cipher puzzle
-- Target word: CIPHER
-- Cipher word: DJQIFS (shifted by 1)
-- Each position has the correct letter at different indices (not all at 0)

INSERT INTO public.puzzles (
  puzzle_date,
  target_word,
  cipher_word,
  letter_sets,
  theme_hint
) VALUES (
  CURRENT_DATE,
  'CIPHER',
  'DJQIFS',
  '[
    ["A", "B", "C", "D", "E"],
    ["G", "H", "I", "J", "K"],
    ["N", "O", "P", "Q", "R"],
    ["G", "H", "I", "J", "K"],
    ["C", "D", "E", "F", "G"],
    ["N", "O", "P", "Q", "R"]
  ]'::jsonb,
  'Codes and secrets'
);

-- Notes:
-- Position 0: Correct is C (index 2 in [A,B,C,D,E])
-- Position 1: Correct is I (index 2 in [G,H,I,J,K])
-- Position 2: Correct is P (index 2 in [N,O,P,Q,R])
-- Position 3: Correct is H (index 1 in [G,H,I,J,K])
-- Position 4: Correct is E (index 2 in [C,D,E,F,G])
-- Position 5: Correct is R (index 4 in [N,O,P,Q,R])

SELECT
  id,
  puzzle_date,
  target_word,
  cipher_word,
  letter_sets,
  theme_hint
FROM public.puzzles
WHERE puzzle_date = CURRENT_DATE;
