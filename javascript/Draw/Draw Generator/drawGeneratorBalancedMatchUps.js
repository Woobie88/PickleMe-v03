
// ---------------------------------------------
// SINGLE-GAME OPTIMIZER (exact — all 3 team splits)
// ---------------------------------------------
function splitIntoTeams(players) {
  const [p1, p2, p3, p4] = players;
  return [
    { teamA: [p1, p2], teamB: [p3, p4] },
    { teamA: [p1, p3], teamB: [p2, p4] },
    { teamA: [p1, p4], teamB: [p2, p3] }
  ];
}

function scoreFullGame({ teamA, teamB }, partnerCounts, opponentCounts, scorers) {
//   const partnerCostA = scorers.scorePairing(teamA[0], teamA[1], partnerCounts);
//   const partnerCostB = scorers.scorePairing(teamB[0], teamB[1], partnerCounts);
  const matchupCost = scorers.scoreMatchup(teamA, teamB, opponentCounts);
  return partnerCostA + partnerCostB + matchupCost;
}

function generateBestGame(players, partnerCounts, opponentCounts, scorers) {
  if (players.length !== 4) {
    throw new Error(`generateBestGame expects exactly 4 players, got ${players.length}`);
  }

  const splits = splitIntoTeams(players);

  let best = null, bestCost = Infinity;
  for (const split of splits) {
    const cost = scoreFullGame(split, partnerCounts, opponentCounts, scorers);
    if (cost < bestCost) { bestCost = cost; best = split; }
  }

  return { ...best, cost: bestCost };
}

// ---------------------------------------------
// ROUND OPTIMIZER (randomized multi-attempt — pool > 4)
// ---------------------------------------------
function combinations(arr, k) {
  const results = [];
  function backtrack(start, path) {
    if (path.length === k) { results.push([...path]); return; }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }
  backtrack(0, []);
  return results;
}

function attemptRound(eligiblePlayers, partnerCounts, opponentCounts, scorers) {
  const pool = shuffle(eligiblePlayers);
  const games = [];
  const used = new Set();
  let cost = 0;

  for (const p1 of pool) {
    if (used.has(p1.PlayerID)) continue;

    const remaining = pool.filter(p => !used.has(p.PlayerID) && p.PlayerID !== p1.PlayerID);
    if (remaining.length < 3) continue; // not enough left to form a foursome

    // Stage 1: candidates within DUPR delta
    let candidates = remaining.filter(p2 =>
      Math.abs((parseFloat(p1.DUPR) || 0) - (parseFloat(p2.DUPR) || 0)) <= scorers.partnerDuprDelta
    );

    // Stage 2: fall back to full remaining pool if not enough fit the delta
    if (candidates.length < 3) {
      candidates = remaining;
    }

    // Cap candidate pool size to keep C(candidates, 3) manageable
    const maxCandidates = scorers.maxGroupCandidates || 10;
    if (candidates.length > maxCandidates) {
      candidates = shuffle(candidates).slice(0, maxCandidates);
    }

    let bestGame = null, bestCost = Infinity;
    const possibleTrios = combinations(candidates, 3);

    for (const trio of possibleTrios) {
      const group = [p1, ...trio];
      const game = generateBestGame(group, partnerCounts, opponentCounts, scorers);
      if (game.cost < bestCost) { bestCost = game.cost; bestGame = game; }
    }

    if (bestGame) {
      games.push(bestGame);
      [...bestGame.teamA, ...bestGame.teamB].forEach(p => used.add(p.PlayerID));
      cost += bestCost;
    }
  }

  return { games, cost };
}

function generateBestRound(eligiblePlayers, partnerCounts, opponentCounts, scorers, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptRound(eligiblePlayers, partnerCounts, opponentCounts, scorers);
    if (result.cost < bestCost) { bestCost = result.cost; best = result.games; }
  }
  return best;
}

function generateBestMatches(groupPlayers, courtNumbers, partnerCounts, opponentCounts, courtCounts, roundNumber, eventId, drawVersion, userEmail, scorers) {
  const matchups = generateBestRound(eligiblePlayers, partnerCounts, opponentCounts, scorers);
  const courted = assignCourts(matchups, courtNumbers, courtCounts);

  return courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail));
}