// ---------------------------------------------
// FLEX + BALANCED MATCHUPS
// ---------------------------------------------
// Depends on drawGeneratorBalancedMatchUps.js: scoreGroupFormation, bestSplitForGroup, combinations
// Depends on drawGenerator.js: shuffle, assignCourts, buildMatchRecord
//
// The core group rules decide WHO may be in a foursome together. The balanced
// matchup logic then scores those foursomes and decides how each one splits
// into teams (best team-average DUPR match, then least partner repetition).
//
// Scorers need the fields drawGeneratorBalancedMatchUps.js already reads:
// partnerFrequencyWeight, opponentFrequencyWeight, groupDuprGapWeight,
// partnerDuprDelta, maxGroupCandidates.

// Above this many players the exact search gets slow (about 0.2s at 20 players,
// 4s at 24), so larger fields use the greedy search instead.
const FLEX_EXACT_SEARCH_MAX_PLAYERS = 20;

// A foursome may never contain both a Core Group 1 and a Core Group 2 player.
// Flex players are eligible with anyone.
function isEligibleFlexGroup(group, coreGroup1Ids, coreGroup2Ids) {
  const hasGroup1Player = group.some(player => coreGroup1Ids.includes(player.PlayerID));
  const hasGroup2Player = group.some(player => coreGroup2Ids.includes(player.PlayerID));
  return !(hasGroup1Player && hasGroup2Player);
}

// ---------------------------------------------
// EXACT SEARCH (up to FLEX_EXACT_SEARCH_MAX_PLAYERS)
// ---------------------------------------------
// Scores every eligible foursome once, then finds the cheapest way to split the
// whole round into foursomes that covers every player exactly once. Returns the
// true best round, not a lucky one, and returns null only if no legal round exists.
function generateBestFlexBalancedRoundExact(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, partnerCounts, opponentCounts, scorers) {
  const playerCount = eligiblePlayers.length;
  if (playerCount % 4 !== 0) return null;

  // 1. Every eligible foursome, scored once. A bitmask identifies its players.
  const foursomesByLowestPlayer = Array.from({ length: playerCount }, () => []);
  for (const indexes of combinations(eligiblePlayers.map((p, i) => i), 4)) {
    const group = indexes.map(i => eligiblePlayers[i]);
    if (!isEligibleFlexGroup(group, coreGroup1Ids, coreGroup2Ids)) continue;

    const groupCost = scoreGroupFormation(group, partnerCounts, opponentCounts, scorers);
    const bestGame = bestSplitForGroup(group, partnerCounts, opponentCounts, scorers);
    const mask = indexes.reduce((m, i) => m | (1 << i), 0);
    foursomesByLowestPlayer[indexes[0]].push({ mask, cost: groupCost + bestGame.cost, game: bestGame });
  }

  // 2. Cheapest exact cover: always place the lowest uncovered player next
  const fullMask = (1 << playerCount) - 1;
  const memo = new Map();

  function solve(coveredMask) {
    if (coveredMask === fullMask) return { cost: 0, games: [] };
    if (memo.has(coveredMask)) return memo.get(coveredMask);

    let lowestFree = 0;
    while (coveredMask & (1 << lowestFree)) lowestFree++;

    let best = null;
    for (const foursome of foursomesByLowestPlayer[lowestFree]) {
      if (foursome.mask & coveredMask) continue;
      const rest = solve(coveredMask | foursome.mask);
      if (!rest) continue;

      // Tiny jitter so equally good rounds vary instead of always picking the same one
      const cost = foursome.cost + rest.cost + Math.random() * 1e-6;
      if (!best || cost < best.cost) best = { cost, games: [foursome.game, ...rest.games] };
    }

    memo.set(coveredMask, best);
    return best;
  }

  const result = solve(0);
  return result ? result.games : null;
}

// ---------------------------------------------
// GREEDY SEARCH (fallback for large fields)
// ---------------------------------------------
function attemptFlexBalancedRound(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, partnerCounts, opponentCounts, scorers) {
  const pool = shuffle(eligiblePlayers);
  const games = [];
  const used = new Set();
  let cost = 0;

  for (const p1 of pool) {
    if (used.has(p1.PlayerID)) continue;

    // Only players p1 is allowed to share a foursome with
    const remaining = pool.filter(p =>
      !used.has(p.PlayerID) &&
      p.PlayerID !== p1.PlayerID &&
      isEligibleFlexGroup([p1, p], coreGroup1Ids, coreGroup2Ids)
    );

    // p1 cannot be placed in any foursome: this attempt is invalid
    if (remaining.length < 3) return { games, cost: Infinity };

    let candidates = remaining.filter(p2 =>
      Math.abs((parseFloat(p1.DUPR) || 0) - (parseFloat(p2.DUPR) || 0)) <= scorers.partnerDuprDelta
    );
    if (candidates.length < 3) candidates = remaining;

    const maxCandidates = scorers.maxGroupCandidates || 10;
    if (candidates.length > maxCandidates) {
      candidates = shuffle(candidates).slice(0, maxCandidates);
    }

    let bestGroup = null, bestGroupCost = Infinity;
    for (const trio of combinations(candidates, 3)) {
      const group = [p1, ...trio];
      if (!isEligibleFlexGroup(group, coreGroup1Ids, coreGroup2Ids)) continue;
      const groupCost = scoreGroupFormation(group, partnerCounts, opponentCounts, scorers);
      if (groupCost < bestGroupCost) { bestGroupCost = groupCost; bestGroup = group; }
    }

    // Every candidate trio broke the core rule: this attempt is invalid
    if (!bestGroup) return { games, cost: Infinity };

    const bestGame = bestSplitForGroup(bestGroup, partnerCounts, opponentCounts, scorers);
    games.push(bestGame);
    [...bestGame.teamA, ...bestGame.teamB].forEach(p => used.add(p.PlayerID));
    cost += bestGroupCost + bestGame.cost;
  }

  return { games, cost };
}

function generateBestFlexBalancedRoundGreedy(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, partnerCounts, opponentCounts, scorers, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptFlexBalancedRound(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, partnerCounts, opponentCounts, scorers);
    if (result.cost < bestCost) { bestCost = result.cost; best = result.games; }
  }
  return best; // null if every attempt hit a dead end
}

// ---------------------------------------------
// CALLING FUNCTION (mirrors generateBestMatches)
// ---------------------------------------------
function generateFlexBalancedMatches(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, courtNumbers, partnerCounts, opponentCounts, courtCounts, roundNumber, eventId, drawVersion, userEmail, scorers) {
  const matchups = eligiblePlayers.length <= FLEX_EXACT_SEARCH_MAX_PLAYERS
    ? generateBestFlexBalancedRoundExact(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, partnerCounts, opponentCounts, scorers)
    : generateBestFlexBalancedRoundGreedy(eligiblePlayers, coreGroup1Ids, coreGroup2Ids, partnerCounts, opponentCounts, scorers);

  if (!matchups || matchups.length !== courtNumbers.length) {
    console.error(`Cannot generate Cross Court draw for round ${roundNumber}: no valid foursomes found under the group rules.`);
    return [];
  }

  const courted = assignCourts(matchups, courtNumbers, courtCounts);
  return courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail));
}