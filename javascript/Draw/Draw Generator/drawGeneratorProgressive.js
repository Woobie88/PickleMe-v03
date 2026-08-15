/**
 * ============================================================
 * KINGS & QUEENS DRAW ENGINE
 *
 * Round 1: reverse-DUPR court assignment (top court = lowest
 * DUPR players), partners balanced purely by DUPR.
 *
 * Rounds 2+: court movement based on Round N-1 results —
 *   Court 1 = winners of Court 1 + winners of Court 2
 *   Court 2 = losers of Court 1 + winners of Court 3
 *   Court 3 = losers of Court 2 + losers of Court 3
 * Partner allocation within each court: hard rule against
 * repartnering with whoever you JUST won with; among legal
 * options, minimize partner-frequency across the whole event
 * so far, with DUPR balance as a tiebreaker.
 *
 * Byes are fixed upfront via the same proven rotation used
 * elsewhere in the app (generateByeSchedule), embedded into a
 * full dummy schedule generated at draw-creation time. Rounds
 * 2+ start as Rotating-Partners placeholder matches purely to
 * lock in a fair bye roster; advanceKingsQueensRound() later
 * overwrites that round's real match records once results
 * exist, deriving that round's byes from who's simply absent
 * from the placeholder matches.
 *
 * Depends on shared functions already defined elsewhere in the
 * app: teamAvgDupr, calculateWinProbability, shuffle,
 * buildDrawHistory, generateMatchId, generateByeSchedule,
 * generateGroupMatches, buildMatchRecord.
 * ============================================================
 */

// ---------- ROUND 1: reverse-DUPR courts, balanced partners ----------

function bestBalancedPairing(fourPlayers) {
  const [a, b, c, d] = fourPlayers;
  const options = [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] }
  ];
  let best = options[0], bestGap = Infinity;
  options.forEach(opt => {
    const gap = Math.abs(teamAvgDupr(opt.teamA) - teamAvgDupr(opt.teamB));
    if (gap < bestGap) { bestGap = gap; best = opt; }
  });
  return best;
}

function buildKingsQueensRound1(activePlayers, courtsCount, eventId, drawVersion, userEmail) {
  // Sort ascending — lowest DUPR first, since top court (Court 1) gets the LOWEST DUPR players
  const sortedAsc = [...activePlayers].sort((a, b) => (parseFloat(a.DUPR) || 0) - (parseFloat(b.DUPR) || 0));

  const courts = [];
  for (let c = 0; c < courtsCount; c++) {
    courts.push(sortedAsc.slice(c * 4, c * 4 + 4));
  }

  const matches = [];
  courts.forEach((courtPlayers, idx) => {
    const courtNumber = idx + 1;
    const pairing = bestBalancedPairing(courtPlayers);
    const record = buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
      0, 1, eventId, drawVersion, userEmail
    );
    matches.push(record);
  });

  return matches;
}

// ---------- DUMMY FULL-EVENT SCHEDULE (locks in bye rotation upfront) ----------

function buildKingsQueensDummySchedule(players, numberOfRounds, courtsCount, eventId, drawVersion, userEmail) {
  const byeSchedule = generateByeSchedule(players, numberOfRounds, courtsCount);

  let allMatches = [];

  // Round 1 — the real, rule-correct starting round
  const round1Byes = byeSchedule[0] || [];
  const round1ActivePlayers = players.filter(p => !round1Byes.includes(p.PlayerID));
  const round1Matches = buildKingsQueensRound1(round1ActivePlayers, courtsCount, eventId, drawVersion, userEmail);
  allMatches.push(...round1Matches);

  // Rounds 2+ — placeholder shells, purely to lock in the bye roster for each round
  for (let i = 1; i < numberOfRounds; i++) {
    const roundNumber = i + 1;
    const byesThisRound = byeSchedule[i] || [];
    const activePlayers = players.filter(p => !byesThisRound.includes(p.PlayerID));

    const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(allMatches);
    const courtNumbers = Array.from({ length: courtsCount }, (_, idx) => idx + 1);

    const placeholderMatches = generateGroupMatches(
      activePlayers, courtNumbers, partnerCounts, opponentCounts, courtCounts,
      roundNumber, eventId, drawVersion
    );
    placeholderMatches.forEach(m => { m.UserEmail = userEmail; });

    allMatches.push(...placeholderMatches);
  }

  return allMatches;
}

// ---------- RESULT-BASED COURT MOVEMENT ----------

function getMatchWinners(match) {
  if (match.Team1WinLoss === 'Win') return [match.Team1Player1, match.Team1Player2];
  if (match.Team2WinLoss === 'Win') return [match.Team2Player1, match.Team2Player2];
  return null;
}

function getMatchLosers(match) {
  if (match.Team1WinLoss === 'Loss') return [match.Team1Player1, match.Team1Player2];
  if (match.Team2WinLoss === 'Loss') return [match.Team2Player1, match.Team2Player2];
  return null;
}

function isRoundComplete(matches, roundNumber) {
  const roundMatches = matches.filter(m => parseInt(m.Round) === roundNumber);
  if (roundMatches.length === 0) return false;
  return roundMatches.every(m => m.Team1WinLoss && m.Team2WinLoss);
}

function buildResultBasedGroups(previousRoundMatches) {
  const byCourt = {};
  previousRoundMatches.forEach(m => { byCourt[m.Court] = m; });

  const ct1Winners = getMatchWinners(byCourt[1]);
  const ct1Losers = getMatchLosers(byCourt[1]);
  const ct2Winners = getMatchWinners(byCourt[2]);
  const ct2Losers = getMatchLosers(byCourt[2]);
  const ct3Winners = getMatchWinners(byCourt[3]);
  const ct3Losers = getMatchLosers(byCourt[3]);

  return [
    { court: 1, playerIds: [...ct1Winners, ...ct2Winners], justWonPairs: [ct1Winners, ct2Winners] },
    { court: 2, playerIds: [...ct1Losers, ...ct3Winners], justWonPairs: [ct3Winners] },
    { court: 3, playerIds: [...ct2Losers, ...ct3Losers], justWonPairs: [] }
  ];
}

// ---------- PARTNER ALLOCATION (shared by normal pairing AND bye swaps) ----------

function bestKingsQueensPairing(fourPlayers, justWonPairIds, partnerCounts) {
  const [a, b, c, d] = fourPlayers;
  const options = [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] }
  ];

  const isJustWonPair = (p1, p2) => justWonPairIds.some(pair =>
    pair.includes(p1.PlayerID) && pair.includes(p2.PlayerID)
  );

  const legalOptions = options.filter(opt =>
    !isJustWonPair(opt.teamA[0], opt.teamA[1]) && !isJustWonPair(opt.teamB[0], opt.teamB[1])
  );

  const candidates = legalOptions.length > 0 ? legalOptions : options; // safety fallback

  let best = candidates[0], bestScore = Infinity;
  candidates.forEach(opt => {
    const repeatA = (partnerCounts[opt.teamA[0].PlayerID]?.[opt.teamA[1].PlayerID]) || 0;
    const repeatB = (partnerCounts[opt.teamB[0].PlayerID]?.[opt.teamB[1].PlayerID]) || 0;
    const duprGap = Math.abs(teamAvgDupr(opt.teamA) - teamAvgDupr(opt.teamB));
    const score = (repeatA + repeatB) * 100 + duprGap * 10;
    if (score < bestScore) { bestScore = score; best = opt; }
  });

  return { pairing: best, score: bestScore };
}

// ---------- BYE HANDLING ----------

function getByePlayersForRound(allPlayers, roundMatches) {
  const playingIds = new Set();
  roundMatches.forEach(m => {
    [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4,
     m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4]
      .filter(Boolean)
      .forEach(pid => playingIds.add(pid));
  });
  return allPlayers.filter(p => !playingIds.has(p.PlayerID)).map(p => p.PlayerID);
}

function applyByeSwaps(groups, byePlayerIdsThisRound, allPlayersById, partnerCounts) {
  const outgoing = [];
  groups.forEach(g => {
    g.playerIds.forEach(pid => {
      if (byePlayerIdsThisRound.includes(pid)) outgoing.push({ pid, court: g.court });
    });
  });

  const placedSoFar = new Set(groups.flatMap(g => g.playerIds));
  let incomingPlayers = Object.keys(allPlayersById).filter(
    pid => !byePlayerIdsThisRound.includes(pid) && !placedSoFar.has(pid)
  );

  outgoing.forEach(({ pid: outgoingId, court }) => {
    const group = groups.find(g => g.court === court);
    const outgoingIndex = group.playerIds.indexOf(outgoingId);

    let bestCandidate = null, bestCandidateScore = Infinity;

    incomingPlayers.forEach(candidateId => {
      const testIds = [...group.playerIds];
      testIds[outgoingIndex] = candidateId;
      const testPlayers = testIds.map(id => allPlayersById[id]);

      const result = bestKingsQueensPairing(testPlayers, group.justWonPairs, partnerCounts);
      if (result.score < bestCandidateScore) {
        bestCandidateScore = result.score;
        bestCandidate = candidateId;
      }
    });

    if (bestCandidate) {
      group.playerIds[outgoingIndex] = bestCandidate;
      incomingPlayers = incomingPlayers.filter(id => id !== bestCandidate);
    }
  });

  return groups;
}

// ---------- MAIN ENTRY POINT: ADVANCE ONE ROUND ----------

function advanceKingsQueensRound(allMatchesSoFar, nextRoundDummyMatches, allPlayers, roundNumber, eventId, drawVersion, userEmail) {
  if (!isRoundComplete(allMatchesSoFar, roundNumber - 1)) {
    console.error("Cannot advance — previous round has unrecorded results.");
    return null;
  }

  const byePlayerIdsThisRound = getByePlayersForRound(allPlayers, nextRoundDummyMatches);

  const allPlayersById = {};
  allPlayers.forEach(p => { allPlayersById[p.PlayerID] = p; });

  const previousRoundMatches = allMatchesSoFar.filter(m => parseInt(m.Round) === roundNumber - 1);
  const groups = buildResultBasedGroups(previousRoundMatches);

  const { partnerCounts } = buildDrawHistory(allMatchesSoFar); // FULL event history, not just previous round

  applyByeSwaps(groups, byePlayerIdsThisRound, allPlayersById, partnerCounts);

  const updatedMatches = groups.map(group => {
    const fourPlayers = group.playerIds.map(pid => allPlayersById[pid]);
    const { pairing } = bestKingsQueensPairing(fourPlayers, group.justWonPairs, partnerCounts);

    const dummyMatch = nextRoundDummyMatches.find(m => parseInt(m.Court) === group.court);

    const avg1 = teamAvgDupr(pairing.teamA);
    const avg2 = teamAvgDupr(pairing.teamB);
    const winProb1 = calculateWinProbability(avg1, avg2);

    return {
      ...dummyMatch,
      Team1Player1: pairing.teamA[0].PlayerID,
      Team1Player2: pairing.teamA[1].PlayerID,
      Team2Player1: pairing.teamB[0].PlayerID,
      Team2Player2: pairing.teamB[1].PlayerID,
      Team1AvgDUPR: avg1,
      Team2AvgDUPR: avg2,
      DUPRMatchDelta: Math.abs(avg1 - avg2),
      Team1WinProb: winProb1,
      Team2WinProb: 1 - winProb1,
      ExpectedTeam1Score: winProb1 >= 0.5 ? 11 : Math.round(winProb1 * 11 / (1 - winProb1)),
      ExpectedTeam2Score: winProb1 >= 0.5 ? Math.round((1 - winProb1) * 11 / winProb1) : 11,
      Team1Score: 0,
      Team2Score: 0,
      Team1WinLoss: '',
      Team2WinLoss: ''
    };
  });

  return updatedMatches;
}