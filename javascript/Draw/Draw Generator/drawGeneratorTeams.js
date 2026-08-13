/**
 * ============================================================
 * TEAMS DRAW ENGINE
 * For games where Team === "Yes" and Division === "No" (e.g.
 * the "teams" game type). Handles the 5 verified scenarios:
 * full round-robin (every active team plays every other team
 * simultaneously), standard pairing (each team plays one
 * opponent, extra courts double up), whole-team byes, and
 * individual within-team byes — reusing your existing verified
 * bye-rotation logic at whichever level applies each round.
 * ============================================================
 */

// ---------- ROUND STRUCTURE (verified against all 5 examples) ----------

function determineTeamRoundStructure(totalTeams, courtsCount) {
  for (let activeTeams = totalTeams; activeTeams >= 2; activeTeams--) {
    const numPairingsFull = (activeTeams * (activeTeams - 1)) / 2;
    if (numPairingsFull > 0 && courtsCount % numPairingsFull === 0) {
      return { mode: 'full', activeTeams, courtsPerPairing: courtsCount / numPairingsFull };
    }
    if (activeTeams % 2 === 0) {
      const numPairingsStandard = activeTeams / 2;
      if (courtsCount % numPairingsStandard === 0) {
        return { mode: 'standard', activeTeams, courtsPerPairing: courtsCount / numPairingsStandard };
      }
    }
  }
  return null;
}

// ---------- GENERIC BYE ROTATION (same mechanism as generateByeSchedule, parameterized) ----------

function generateEntityByeSchedule(entityIds, numberOfRounds, neededPerRound) {
  const byesByRound = {};

  if (neededPerRound <= 0) {
    for (let i = 0; i < numberOfRounds; i++) byesByRound[i] = [];
    return byesByRound;
  }

  const baseOrder = shuffle([...entityIds]);
  let pointer = 0;

  for (let round = 0; round < numberOfRounds; round++) {
    const byes = [];
    for (let i = 0; i < neededPerRound; i++) {
      byes.push(baseOrder[pointer % baseOrder.length]);
      pointer++;
    }
    byesByRound[round] = byes;
  }

  return byesByRound;
}

// ---------- TEAM-LEVEL HISTORY (opponent repeats between whole teams) ----------

function buildTeamOpponentHistory(matches) {
  const teamOpponentCounts = {};

  matches.forEach(m => {
    if (m.Team1 === undefined || m.Team2 === undefined) return;
    if (!teamOpponentCounts[m.Team1]) teamOpponentCounts[m.Team1] = {};
    if (!teamOpponentCounts[m.Team2]) teamOpponentCounts[m.Team2] = {};
    teamOpponentCounts[m.Team1][m.Team2] = (teamOpponentCounts[m.Team1][m.Team2] || 0) + 1;
    teamOpponentCounts[m.Team2][m.Team1] = (teamOpponentCounts[m.Team2][m.Team1] || 0) + 1;
  });

  return teamOpponentCounts;
}

// ---------- TEAM PAIRING FOR ONE ROUND ----------

function pairActiveTeamsForRound(activeTeamKeys, mode, teamOpponentCounts) {
  if (mode === 'full') {
    // Every active team plays every other — no decision needed, complete graph.
    const pairings = [];
    for (let i = 0; i < activeTeamKeys.length; i++) {
      for (let j = i + 1; j < activeTeamKeys.length; j++) {
        pairings.push([activeTeamKeys[i], activeTeamKeys[j]]);
      }
    }
    return pairings;
  }

  // Standard mode — greedily pair teams to minimize opponent repeats,
  // same random-restart greedy pattern used elsewhere in the app.
  let best = null, bestCost = Infinity;

  for (let attempt = 0; attempt < 200; attempt++) {
    const pool = shuffle([...activeTeamKeys]);
    const pairings = [];
    const used = new Set();
    let cost = 0;

    for (let i = 0; i < pool.length; i++) {
      if (used.has(pool[i])) continue;
      let bestPartner = null, bestPartnerCost = Infinity;

      for (let j = 0; j < pool.length; j++) {
        if (i === j || used.has(pool[j])) continue;
        const repeatCount = (teamOpponentCounts[pool[i]]?.[pool[j]]) || 0;
        if (repeatCount < bestPartnerCost) { bestPartnerCost = repeatCount; bestPartner = pool[j]; }
      }

      if (bestPartner) {
        pairings.push([pool[i], bestPartner]);
        used.add(pool[i]);
        used.add(bestPartner);
        cost += bestPartnerCost;
      }
    }

    if (cost < bestCost) { bestCost = cost; best = pairings; }
  }

  return best;
}

// ---------- BIPARTITE PLAYER-PAIR ASSIGNMENT (team A's pairs vs team B's pairs) ----------

function assignBipartitePairings(teamAPairs, teamBPairs, opponentCounts) {
  let best = null, bestCost = Infinity;

  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffledB = shuffle([...teamBPairs]);
    let cost = 0;

    teamAPairs.forEach((pairA, idx) => {
      const pairB = shuffledB[idx];
      pairA.forEach(p1 => pairB.forEach(p2 => {
        cost += (opponentCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;
      }));
    });

    if (cost < bestCost) {
      bestCost = cost;
      best = teamAPairs.map((pairA, idx) => ({ teamA: pairA, teamB: shuffledB[idx] }));
    }
  }

  return best;
}

// ---------- MAIN ENTRY POINT: ONE ROUND ----------

function generateTeamsRoundDraw(players, matches, roundNumber, courtsCount, eventId, drawVersion, userEmail, totalTeamsInput) {
  const structure = determineTeamRoundStructure(totalTeamsInput, courtsCount);
  if (!structure) {
    console.error(`No valid team round structure found for ${totalTeamsInput} teams / ${courtsCount} courts.`);
    return [];
  }

  const allTeams = {};
  players.forEach(p => { (allTeams[p.Team] = allTeams[p.Team] || []).push(p); });
  const allTeamKeys = Object.keys(allTeams).sort((a, b) => parseInt(a) - parseInt(b));

  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);
  const teamOpponentCounts = buildTeamOpponentHistory(matches);

  const wholeTeamByesNeeded = allTeamKeys.length - structure.activeTeams;
  window.gdTeamByeCache = window.gdTeamByeCache || {};
  const teamByeCacheKey = `${eventId}_teamByes`;
  if (!window.gdTeamByeCache[teamByeCacheKey]) {
    window.gdTeamByeCache[teamByeCacheKey] = generateEntityByeSchedule(allTeamKeys, window.gdCurrentNumberOfRounds || 1, wholeTeamByesNeeded);
  }
  const wholeTeamByesThisRound = window.gdTeamByeCache[teamByeCacheKey][roundNumber - 1] || [];
  const activeTeamKeys = allTeamKeys.filter(t => !wholeTeamByesThisRound.includes(t));

  // --- Team pairings for this round ---
  const teamPairings = pairActiveTeamsForRound(activeTeamKeys, structure.mode, teamOpponentCounts);

  // --- How many pairings (opponents) is each active team involved in this round? ---
  const pairingCountPerTeam = {};
  activeTeamKeys.forEach(t => pairingCountPerTeam[t] = 0);
  teamPairings.forEach(([a, b]) => { pairingCountPerTeam[a]++; pairingCountPerTeam[b]++; });

  // --- Individual within-team byes (only when no whole-team bye applies) ---
  let individualByesByTeam = {};
  if (wholeTeamByesNeeded === 0) {
    activeTeamKeys.forEach(teamKey => {
      const teamPlayers = allTeams[teamKey];
      const playersNeeded = 2 * structure.courtsPerPairing * pairingCountPerTeam[teamKey];
      const byesNeeded = Math.max(0, teamPlayers.length - playersNeeded);

      window.gdIndivByeCache = window.gdIndivByeCache || {};
      const cacheKey = `${eventId}_${teamKey}_indivByes`;
      if (!window.gdIndivByeCache[cacheKey]) {
        window.gdIndivByeCache[cacheKey] = generateEntityByeSchedule(
          teamPlayers.map(p => p.PlayerID), window.gdCurrentNumberOfRounds || 1, byesNeeded
        );
      }
      individualByesByTeam[teamKey] = window.gdIndivByeCache[cacheKey][roundNumber - 1] || [];
    });
  }

  // --- FIX: build each active team's FULL pair-pool ONCE, then slice it across its opponents ---
  const teamPairPools = {};
  activeTeamKeys.forEach(teamKey => {
    const activePlayers = allTeams[teamKey].filter(p => !(individualByesByTeam[teamKey] || []).includes(p.PlayerID));
    teamPairPools[teamKey] = generateBestPartnerships(activePlayers, partnerCounts); // built ONCE per team per round
  });

  // Track how many pairs of each team's pool have already been handed out to an opponent
  const teamPoolCursor = {};
  activeTeamKeys.forEach(t => teamPoolCursor[t] = 0);

  const allMatches = [];
  let courtCursor = 1;

  teamPairings.forEach(([teamAKey, teamBKey]) => {
    const cpp = structure.courtsPerPairing;

    const teamAChunk = teamPairPools[teamAKey].slice(teamPoolCursor[teamAKey], teamPoolCursor[teamAKey] + cpp);
    const teamBChunk = teamPairPools[teamBKey].slice(teamPoolCursor[teamBKey], teamPoolCursor[teamBKey] + cpp);
    teamPoolCursor[teamAKey] += cpp;
    teamPoolCursor[teamBKey] += cpp;

    if (teamAChunk.length === 0 || teamBChunk.length === 0) {
        console.warn(`Skipping pairing ${teamAKey} vs ${teamBKey} — pair pool exhausted (likely a stale bye cache or structure mismatch).`);
        return; // NEW — don't reserve court numbers for a pairing that can't produce a match
    }

    const matchups = assignBipartitePairings(teamAChunk, teamBChunk, opponentCounts);

    const courtNumbers = [];
    for (let i = 0; i < cpp; i++) {
        courtNumbers.push(courtCursor);
        courtCursor++;
    }

    const courted = assignCourts(matchups, courtNumbers, courtCounts);
    const records = courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail));
    allMatches.push(...records);
    });

  return allMatches;
}