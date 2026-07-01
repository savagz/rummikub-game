const COLORS = ['red', 'blue', 'black', 'yellow'];

export function createDeck() {
  const tiles = [];
  let id = 0;
  for (let set = 0; set < 2; set++) {
    for (const color of COLORS) {
      for (let num = 1; num <= 13; num++) {
        tiles.push({ id: `${color}_${num}_${set}`, color, number: num, isJoker: false });
        id++;
      }
    }
  }
  tiles.push({ id: 'joker_0', color: null, number: null, isJoker: true });
  tiles.push({ id: 'joker_1', color: null, number: null, isJoker: true });
  return shuffle(tiles);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealTiles(deck, count) {
  return { tiles: deck.slice(0, count), remaining: deck.slice(count) };
}

export function isValidRun(tiles) {
  if (tiles.length < 3) return false;
  const jokerCount = tiles.filter(t => t.isJoker).length;
  const real = tiles.filter(t => !t.isJoker);
  if (real.length === 0) return false;

  const colors = new Set(real.map(t => t.color));
  if (colors.size !== 1) return false;

  const nums = real.map(t => t.number).sort((a, b) => a - b);
  if (new Set(nums).size !== nums.length) return false; // duplicates

  let gaps = 0;
  for (let i = 1; i < nums.length; i++) {
    gaps += nums[i] - nums[i - 1] - 1;
    if (gaps > jokerCount) return false;
  }

  const extra = jokerCount - gaps;
  const min = nums[0];
  const max = nums[nums.length - 1];

  for (let before = 0; before <= extra; before++) {
    const start = min - before;
    const end = max + (extra - before);
    if (start >= 1 && end <= 13) return true;
  }
  return false;
}

export function isValidGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const real = tiles.filter(t => !t.isJoker);
  if (real.length === 0) return false;

  const numbers = new Set(real.map(t => t.number));
  if (numbers.size !== 1) return false;

  const colors = real.map(t => t.color);
  if (new Set(colors).size !== colors.length) return false;
  return true;
}

export function isValidMeld(tiles) {
  return isValidRun(tiles) || isValidGroup(tiles);
}

export function tryReplaceJoker(meld, handTile) {
  if (!meld.some(t => t.isJoker) || handTile.isJoker) return null;

  for (let i = 0; i < meld.length; i++) {
    if (!meld[i].isJoker) continue;

    const testMeld = meld.map((t, j) => j === i ? handTile : t);
    if (isValidMeld(testMeld)) {
      return { jokerIndex: i };
    }
  }
  return null;
}

export function calculateScore(tiles) {
  return tiles.reduce((sum, t) => {
    if (t.isJoker) return sum + 30;
    return sum + t.number;
  }, 0);
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
