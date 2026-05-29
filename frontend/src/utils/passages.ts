import type { Passage, WordCount, PhraseLength, Mode } from '../types';
import { generateRandomWords } from './words';

const PHRASE_LENGTH_MAP: Record<PhraseLength, number | null> = {
  short: 15,
  medium: 30,
  long: 50,
  thicc: 80,
  all: null, // full passage
};

export const passages: Passage[] = [
  {
    text: "In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since. Whenever you feel like criticizing any one, he told me, just remember that all the people in this world have not had the advantages that you have had.",
    author: "F. Scott Fitzgerald",
    source: "The Great Gatsby"
  },
  {
    text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.",
    author: "Jane Austen",
    source: "Pride and Prejudice"
  },
  {
    text: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.",
    author: "Herman Melville",
    source: "Moby Dick"
  },
  {
    text: "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.",
    author: "George Orwell",
    source: "1984"
  },
  {
    text: "Maycomb was an old town, but it was a tired old town when I first knew it. In rainy weather the streets turned to red slop; grass grew on the sidewalks, the courthouse sagged in the square. Somehow it was hotter then: a black dog suffered on a summer's day.",
    author: "Harper Lee",
    source: "To Kill a Mockingbird"
  },
  {
    text: "The sun had not yet risen over the moors, and the air was cold and still. Somewhere in the distance a lark was singing, its song carrying across the heather like a thread of gold in the grey fabric of dawn.",
    author: "Emily Brontë",
    source: "Wuthering Heights"
  },
  {
    text: "The studio was filled with the rich odor of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of lilac, or the more delicate perfume of the pink-flowering thorn.",
    author: "Oscar Wilde",
    source: "The Picture of Dorian Gray"
  },
  {
    text: "There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further outdoor exercise was now out of the question.",
    author: "Charlotte Brontë",
    source: "Jane Eyre"
  },
  {
    text: "To the red country and part of the gray country of Oklahoma, the last rains came gently, and they did not cut the scarred earth. The plows crossed and recrossed the rivulet marks. The rain lands were fertile, and the corn grew tall and green in the summer heat.",
    author: "John Steinbeck",
    source: "The Grapes of Wrath"
  },
  {
    text: "The old man was thin and gaunt with deep wrinkles in the back of his neck. The brown blotches of the benevolent skin cancer the sun brings from its reflection on the tropic sea were on his cheeks. Everything about him was old except his eyes and they were the same color as the sea.",
    author: "Ernest Hemingway",
    source: "The Old Man and the Sea"
  }
];

export function getRandomPassage(): Passage {
  return passages[Math.floor(Math.random() * passages.length)];
}

function truncateToWords(text: string, count: number): string {
  return text.split(/\s+/).slice(0, count).join(' ');
}

export function generateTestPassage(
  mode: Mode,
  duration: number,
  wordCount: WordCount,
  phraseLength?: PhraseLength,
): Passage {
  if (mode === 'time' || mode === 'words') {
    const wordLimit = mode === 'words' ? wordCount : Math.max(200, duration * 4);
    return {
      text: generateRandomWords(wordLimit),
      author: 'random',
      source: 'word list',
    };
  }

  const base = getRandomPassage();
  const limit = phraseLength ? PHRASE_LENGTH_MAP[phraseLength] : null;
  if (limit !== null) {
    return { ...base, text: truncateToWords(base.text, limit) };
  }
  return base;
}
