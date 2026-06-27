/**
 * xpSystem.js
 * Centralised XP / Level / Title logic — import everywhere needed.
 */

const XP_PER_QUESTION = 10;

// Scalable level formula: Level = floor(sqrt(xp / 50)) + 1
// xp 0   → L1  | xp 50   → L2  | xp 200  → L3
// xp 450 → L4  | xp 800  → L5  | xp 1250 → L6
// xp 5000→ L11 | xp 10000→ L15
const getLevel = (xp = 0) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;

// XP needed to reach a given level (inverse formula)
const xpForLevel = (level) => Math.pow(level - 1, 2) * 50;

// Islamic learning titles — awarded by cumulative XP threshold
const TITLES = [
  { minXp: 0,     title: "طالبِ علم",       titleEn: "Seeker of Knowledge" },
  { minXp: 100,   title: "متعلم",           titleEn: "Student" },
  { minXp: 300,   title: "علم کا مسافر",    titleEn: "Traveller of Knowledge" },
  { minXp: 700,   title: "متلاشیِ حق",      titleEn: "Seeker of Truth" },
  { minXp: 1500,  title: "فہمِ دین",        titleEn: "Understanding of Religion" },
  { minXp: 3000,  title: "محقق",            titleEn: "Researcher" },
  { minXp: 6000,  title: "داعیِ علم",       titleEn: "Caller to Knowledge" },
  { minXp: 10000, title: "حکمت کے طالب",    titleEn: "Seeker of Wisdom" },
];

/**
 * Return the title object { title, titleEn, minXp } for the given XP.
 */
const getTitleObj = (xp = 0) => {
  let current = TITLES[0];
  for (const t of TITLES) {
    if (xp >= t.minXp) current = t;
    else break;
  }
  return current;
};

const getTitle = (xp = 0) => getTitleObj(xp).title;

/**
 * Return the next title threshold info (for progress bar to next title).
 */
const getNextTitle = (xp = 0) => {
  for (const t of TITLES) {
    if (xp < t.minXp) return t;
  }
  return null; // already at max title
};

/**
 * Mutate a Mongoose user document to recalculate level and title from xp.
 * Call this before user.save() whenever xp changes.
 */
const recalcUser = (user) => {
  user.level = getLevel(user.xp);
  user.title = getTitle(user.xp);
  return user;
};

/**
 * Return true if the user's title CHANGED after earning newXp.
 * Used by Android app to show a celebration dialog.
 */
const didTitleChange = (oldXp, newXp) =>
  getTitle(oldXp) !== getTitle(newXp);

module.exports = {
  XP_PER_QUESTION,
  getLevel,
  xpForLevel,
  getTitle,
  getTitleObj,
  getNextTitle,
  recalcUser,
  didTitleChange,
  TITLES,
};
