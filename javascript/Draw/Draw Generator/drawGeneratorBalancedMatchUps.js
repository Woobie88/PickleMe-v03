
// ---------------------------------------------
// STAGE 1 (macro): GROUP FORMATION — pick best 4
// ---------------------------------------------
function scoreGroupFormation(group, partnerCounts, opponentCounts, scorers) {
  let duprCost = 0;
  let freqCost = 0;

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const p1 = group[i], p2 = group[j];
      const duprGap = Math.abs((parseFloat(p1.DUPR) || 0) - (parseFloat(p2.DUPR) || 0));
      const partnerRepeats = (partnerCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;
      const opponentRepeats = (opponentCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;

      duprCost += duprGap;
      freqCost += partnerRepeats * scorers.partnerFrequencyWeight
                + opponentRepeats * scorers.opponentFrequencyWeight;
    }
  }

  return duprCost * scorers.groupDuprGapWeight + freqCost;
}

// ---------------------------------------------
// STAGE 2 (micro): TEAM SPLIT — pick best 2v2 within the group
// ---------------------------------------------
function splitIntoTeams(players) {
  const [p1, p2, p3, p4] = players;
  return [
    { teamA: [p1, p2], teamB: [p3, p4] },
    { teamA: [p1, p3], teamB: [p2, p4] },
    { teamA: [p1, p4], teamB: [p2, p3] }
  ];
}

function bestSplitForGroup(group, partnerCounts, opponentCounts, scorers) {
  const splits = splitIntoTeams(group);

  const scored = splits.map(split => {
    const partnerCostA = scorers.scorePairing(split.teamA[0], split.teamA[1], partnerCounts);
    const partnerCostB = scorers.scorePairing(split.teamB[0], split.teamB[1], partnerCounts);
    const matchupCost = scorers.scoreMatchup(split.teamA, split.teamB, opponentCounts); // avg-delta based
    return { ...split, partnerCost: partnerCostA + partnerCostB, matchupCost };
  });

  // Primary: minimize team-average DUPR delta (matchupCost).
  // Secondary: if two splits balance the teams equally well, prefer the one with less partner repetition.
  scored.sort((x, y) => (x.matchupCost - y.matchupCost) || (x.partnerCost - y.partnerCost));

  const best = scored[0];
  return { ...best, cost: best.partnerCost + best.matchupCost };
}

// ---------------------------------------------
// COMBINATIONS HELPER
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

// ---------------------------------------------
// ROUND OPTIMIZER (randomized multi-attempt)
// ---------------------------------------------
function attemptRound(eligiblePlayers, partnerCounts, opponentCounts, scorers) {
  const pool = shuffle(eligiblePlayers);
  const games = [];
  const used = new Set();
  let cost = 0;

  for (const p1 of pool) {
    if (used.has(p1.PlayerID)) continue;

    const remaining = pool.filter(p => !used.has(p.PlayerID) && p.PlayerID !== p1.PlayerID);
    if (remaining.length < 3) continue; // not enough left to form a foursome

    // Stage 1 candidate filtering
    let candidates = remaining.filter(p2 =>
      Math.abs((parseFloat(p1.DUPR) || 0) - (parseFloat(p2.DUPR) || 0)) <= scorers.partnerDuprDelta
    );
    if (candidates.length < 3) candidates = remaining;

    const maxCandidates = scorers.maxGroupCandidates || 10;
    if (candidates.length > maxCandidates) {
      candidates = shuffle(candidates).slice(0, maxCandidates);
    }

    // Stage 1 (macro): find the best-formed group of 4
    let bestGroup = null, bestGroupCost = Infinity;
    for (const trio of combinations(candidates, 3)) {
      const group = [p1, ...trio];
      const groupCost = scoreGroupFormation(group, partnerCounts, opponentCounts, scorers);
      if (groupCost < bestGroupCost) { bestGroupCost = groupCost; bestGroup = group; }
    }

    if (!bestGroup) continue;

    // Stage 2 (micro): find the best team split within that group
    const bestGame = bestSplitForGroup(bestGroup, partnerCounts, opponentCounts, scorers);
    console.log(scored.map(s => ({
        teamA: s.teamA.map(p => p.DUPR),
        teamB: s.teamB.map(p => p.DUPR),
        matchupCost: s.matchupCost,
        partnerCost: s.partnerCost
        })));

    games.push(bestGame);
    [...bestGame.teamA, ...bestGame.teamB].forEach(p => used.add(p.PlayerID));
    cost += bestGroupCost + bestGame.cost;
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

// ---------------------------------------------
// CALLING FUNCTION FROM: generateRoundDraw
// ---------------------------------------------

function generateBestMatches(eligiblePlayers, courtNumbers, partnerCounts, opponentCounts, courtCounts, roundNumber, eventId, drawVersion, userEmail, scorers) {
  const matchups = generateBestRound(eligiblePlayers, partnerCounts, opponentCounts, scorers);
  const courted = assignCourts(matchups, courtNumbers, courtCounts);

  return courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail));
}