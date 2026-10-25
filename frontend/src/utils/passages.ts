import type { Passage, WordCount, Mode, PhraseLength, TextType } from '../types';
import { generateRandomWords } from './words';

export function charLengthToType(charLength: number): TextType {
  if (charLength < 100) return 'SHORT';
  if (charLength < 300) return 'MEDIUM';
  if (charLength < 600) return 'LONG';
  return 'THICC';
}

const TYPE_BANDS: Record<TextType, [number, number]> = {
  SHORT: [40, 99],
  MEDIUM: [100, 299],
  LONG: [300, 599],
  THICC: [600, 900],
};

const rawPassages: Passage[] = [
  {
    title: "The Great Gatsby",
    text: "In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since. Whenever you feel like criticizing any one, he told me, just remember that all the people in this world have not had the advantages that you have had.",
    author: "F. Scott Fitzgerald",
    source: "The Great Gatsby"
  },
  {
    title: "Pride and Prejudice",
    text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.",
    author: "Jane Austen",
    source: "Pride and Prejudice"
  },
  {
    title: "Moby Dick",
    text: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.",
    author: "Herman Melville",
    source: "Moby Dick"
  },
  {
    title: "1984",
    text: "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.",
    author: "George Orwell",
    source: "1984"
  },
  {
    title: "To Kill a Mockingbird",
    text: "Maycomb was an old town, but it was a tired old town when I first knew it. In rainy weather the streets turned to red slop; grass grew on the sidewalks, the courthouse sagged in the square. Somehow it was hotter then: a black dog suffered on a summer's day.",
    author: "Harper Lee",
    source: "To Kill a Mockingbird"
  },
  {
    title: "Wuthering Heights",
    text: "The sun had not yet risen over the moors, and the air was cold and still. Somewhere in the distance a lark was singing, its song carrying across the heather like a thread of gold in the grey fabric of dawn.",
    author: "Emily Brontë",
    source: "Wuthering Heights"
  },
  {
    title: "The Picture of Dorian Gray",
    text: "The studio was filled with the rich odor of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of lilac, or the more delicate perfume of the pink-flowering thorn.",
    author: "Oscar Wilde",
    source: "The Picture of Dorian Gray"
  },
  {
    title: "Jane Eyre",
    text: "There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further outdoor exercise was now out of the question.",
    author: "Charlotte Brontë",
    source: "Jane Eyre"
  },
  {
    title: "The Grapes of Wrath",
    text: "To the red country and part of the gray country of Oklahoma, the last rains came gently, and they did not cut the scarred earth. The plows crossed and recrossed the rivulet marks. The rain lands were fertile, and the corn grew tall and green in the summer heat.",
    author: "John Steinbeck",
    source: "The Grapes of Wrath"
  },
  {
    title: "The Old Man and the Sea",
    text: "The old man was thin and gaunt with deep wrinkles in the back of his neck. The brown blotches of the benevolent skin cancer the sun brings from its reflection on the tropic sea were on his cheeks. Everything about him was old except his eyes and they were the same color as the sea.",
    author: "Ernest Hemingway",
    source: "The Old Man and the Sea"
  }
];

// Tag each fallback passage with the same length band the backend uses so the local generator
// can honour a requested phrase length instead of leaking whatever text happens to be available.
export const passages: Passage[] = rawPassages.map(passage => ({
  ...passage,
  type: charLengthToType(passage.text.length)
}));

export function getRandomPassage(preferredType?: TextType): Passage {
  const pool = preferredType
    ? passages.filter(passage => passage.type === preferredType)
    : passages;
  const source = pool.length > 0 ? pool : passages;
  return source[Math.floor(Math.random() * source.length)];
}

function synthesizePassage(type: TextType): Passage {
  const [min, max] = TYPE_BANDS[type];
  const target = Math.round((min + max) / 2);
  // The local word list averages roughly six characters per rendered word (word + space).
  const wordTarget = Math.max(8, Math.ceil(target / 6));
  return {
    title: '',
    text: generateRandomWords(wordTarget),
    author: 'random',
    source: 'word list',
    type,
  };
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
      title: '',
      text: generateRandomWords(wordLimit),
      author: 'random',
      source: 'word list',
    };
  }

  if (phraseLength && phraseLength !== 'all') {
    const requestedType = phraseLength.toUpperCase() as TextType;
    const match = passages.filter(passage => passage.type === requestedType);
    // Prefer a real passage of the requested length; otherwise synthesize one so the fallback
    // never violates the requested type constraint.
    return match.length > 0
      ? match[Math.floor(Math.random() * match.length)]
      : synthesizePassage(requestedType);
  }

  return getRandomPassage();
}
