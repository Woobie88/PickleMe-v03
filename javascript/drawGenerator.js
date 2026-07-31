/**
 * ============================================================
 * DRAW GENERATION ENGINE
 * Generates N rounds of round-robin matchups, minimizing
 * partner repeats, opponent repeats, and DUPR gaps, while
 * balancing court exposure. Byes rotate through a fixed
 * shuffled order that repeats each cycle.
 * ============================================================
 */

// ---------- UTILITIES ----------

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function teamAvgDupr(team) {
  const vals = team.map(p => parseFloat(p.DUPR) || 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function calculateWinProbability(duprA, duprB) {
  const diff = duprA - duprB;
  return 1 / (1 + Math.pow(10, -diff / 2));
}

// ---------- BYE SCHEDULE ----------

function generateByeSchedule(players, numberOfRounds, courtsCount) {
  const neededPerRound = Math.max(0, players.length - courtsCount * 4);
  const byesByRound = {};

  if (neededPerRound === 0) {
    for (let i = 0; i < numberOfRounds; i++) {
      byesByRound[i] = [];
    }
    return byesByRound;
  }

  // Shuffle ONCE — this fixed order repeats every cycle
  const baseOrder = shuffle(players.map(p => p.PlayerID));
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

// ---------- HISTORY BUILDING ----------

function buildDrawHistory(matches) {
  const partnerCounts = {};
  const opponentCounts = {};
  const courtCounts = {};

  function bump(map, a, b) {
    if (!map[a]) map[a] = {};
    map[a][b] = (map[a][b] || 0) + 1;
  }

  matches.forEach(m => {
    const t1 = [m.Team1Player1, m.Team1Player2];
    const t2 = [m.Team2Player1, m.Team2Player2];

    bump(partnerCounts, t1[0], t1[1]);
    bump(partnerCounts, t1[1], t1[0]);
    bump(partnerCounts, t2[0], t2[1]);
    bump(partnerCounts, t2[1], t2[0]);

    [...t1].forEach(p1 => [...t2].forEach(p2 => {
      bump(opponentCounts, p1, p2);
      bump(opponentCounts, p2, p1);
    }));

    [...t1, ...t2].forEach(p => {
      if (!courtCounts[p]) courtCounts[p] = {};
      courtCounts[p][m.Court] = (courtCounts[p][m.Court] || 0) + 1;
    });
  });

  return { partnerCounts, opponentCounts, courtCounts };
}

// ---------- PARTNERSHIP GENERATION ----------

function scorePairing(p1, p2, partnerCounts) {
  const repeats = (partnerCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;
  const duprGap = Math.abs((parseFloat(p1.DUPR) || 0) - (parseFloat(p2.DUPR) || 0));
  return repeats * 100 + duprGap * 10;
}

function attemptPartnerships(eligiblePlayers, partnerCounts) {
  const pool = shuffle(eligiblePlayers);
  const pairs = [];
  const used = new Set();
  let cost = 0;

  for (const p1 of pool) {
    if (used.has(p1.PlayerID)) continue;

    let bestPartner = null, bestCost = Infinity;
    for (const p2 of pool) {
      if (p2.PlayerID === p1.PlayerID || used.has(p2.PlayerID)) continue;
      const c = scorePairing(p1, p2, partnerCounts);
      if (c < bestCost) { bestCost = c; bestPartner = p2; }
    }

    if (bestPartner) {
      pairs.push([p1, bestPartner]);
      used.add(p1.PlayerID);
      used.add(bestPartner.PlayerID);
      cost += bestCost;
    }
  }

  return { pairs, cost };
}

function generateBestPartnerships(eligiblePlayers, partnerCounts, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptPartnerships(eligiblePlayers, partnerCounts);
    if (result.cost < bestCost) { bestCost = result.cost; best = result.pairs; }
  }
  return best;
}

// ---------- MATCHUP GENERATION ----------

function scoreMatchup(teamA, teamB, opponentCounts) {
  let repeats = 0;
  teamA.forEach(p1 => teamB.forEach(p2 => {
    repeats += (opponentCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;
  }));
  const duprGap = Math.abs(teamAvgDupr(teamA) - teamAvgDupr(teamB));
  return repeats * 100 + duprGap * 10;
}

function attemptMatchups(partnerships, opponentCounts) {
  const pool = shuffle(partnerships);
  const matchups = [];
  const used = new Set();
  let cost = 0;

  for (let a = 0; a < pool.length; a++) {
    if (used.has(a)) continue;

    let bestIdx = -1, bestCost = Infinity;
    for (let b = 0; b < pool.length; b++) {
      if (b === a || used.has(b)) continue;
      const c = scoreMatchup(pool[a], pool[b], opponentCounts);
      if (c < bestCost) { bestCost = c; bestIdx = b; }
    }

    if (bestIdx !== -1) {
      matchups.push({ teamA: pool[a], teamB: pool[bestIdx] });
      used.add(a);
      used.add(bestIdx);
      cost += bestCost;
    }
  }

  return { matchups, cost };
}

function generateBestMatchups(partnerships, opponentCounts, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptMatchups(partnerships, opponentCounts);
    if (result.cost < bestCost) { bestCost = result.cost; best = result.matchups; }
  }
  return best;
}

// ---------- COURT ALLOCATION ----------

function assignCourts(matchups, courtsCount, courtCounts) {
  const remainingCourts = Array.from({ length: courtsCount }, (_, i) => i + 1);
  const assigned = [];

  matchups.forEach(match => {
    const players = [...match.teamA, ...match.teamB];

    let bestCourt = null, bestScore = Infinity;
    remainingCourts.forEach(court => {
      const score = players.reduce((sum, p) => sum + ((courtCounts[p.PlayerID]?.[court]) || 0), 0);
      if (score < bestScore) { bestScore = score; bestCourt = court; }
    });

    assigned.push({ ...match, court: bestCourt });
    remainingCourts.splice(remainingCourts.indexOf(bestCourt), 1);
  });

  return assigned;
}

// ---------- SINGLE ROUND GENERATION ----------

function generateRoundDraw(players, matches, byePlayerIds, roundNumber, courtsCount, eventId, drawVersion) {
  const eligible = players.filter(p => !byePlayerIds.includes(p.PlayerID));

  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);

  const partnerships = generateBestPartnerships(eligible, partnerCounts);
  const matchups = generateBestMatchups(partnerships, opponentCounts);
  const courted = assignCourts(matchups, courtsCount, courtCounts);

  return courted.map((m, idx) => {
    const avg1 = teamAvgDupr(m.teamA);
    const avg2 = teamAvgDupr(m.teamB);
    const winProb1 = calculateWinProbability(avg1, avg2);

    return {
      MatchID: generateMatchId(),
      EventID: eventId,
      Round: roundNumber,
      Court: m.court,
      DrawVersion: drawVersion,
      MatchType: "Round Robin",
      Team1: idx + 1,
      Team2: idx + 1,
      Team1Player1: m.teamA[0].PlayerID,
      Team1Player2: m.teamA[1].PlayerID,
      Team2Player1: m.teamB[0].PlayerID,
      Team2Player2: m.teamB[1].PlayerID,
      Team1AvgDUPR: avg1,
      Team2AvgDUPR: avg2,
      Team1WinProb: winProb1,
      Team2WinProb: 1 - winProb1,
      ExpectedTeam1Score: winProb1 >= 0.5 ? 11 : Math.min(Math.round(winProb1 * 11 / (1 - winProb1)), 9),
      ExpectedTeam2Score: winProb1 >= 0.5 ? Math.min(Math.round((1 - winProb1) * 11 / winProb1), 9) : 11,
      Team1Score: 0,
      Team2Score: 0,
      Team1WinLoss: '',
      Team2WinLoss: '',
      Timestamp: new Date().toISOString()
    };
  });
}

// ---------- UNIQUE CODE GENERATION ----------

function generateMatchId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ---------- MULTI-ROUND GENERATION ----------

function generateMultipleRounds(players, existingMatches, byesByRound, startRound, numberOfRounds, courtsCount, eventId, drawVersion) {
  let allMatches = [...existingMatches];
  const generatedRounds = [];

  for (let i = 0; i < numberOfRounds; i++) {
    const roundNumber = startRound + i;
    const byesForThisRound = byesByRound[roundNumber] || [];

    const roundMatches = generateRoundDraw(
      players,
      allMatches,
      byesForThisRound,
      roundNumber,
      courtsCount,
      eventId,
      drawVersion
    );

    generatedRounds.push(...roundMatches);
    allMatches = [...allMatches, ...roundMatches];
  }

  return generatedRounds;
}

// ---------- PLAYER SUMMARY -----------------

function logPlayerSummary(players, matches, byesByRound) {
  const summary = {};

  players.forEach(p => {
    summary[p.PlayerID] = {
      games: 0,
      byes: 0,
      partners: {},
      opponents: {}
    };
  });

  // Count byes across all rounds
  Object.values(byesByRound).forEach(byeList => {
    byeList.forEach(pid => {
      if (summary[pid]) summary[pid].byes++;
    });
  });

  // Count games, partners, opponents from generated matches
  matches.forEach(m => {
    const t1 = [m.Team1Player1, m.Team1Player2];
    const t2 = [m.Team2Player1, m.Team2Player2];

    [...t1, ...t2].forEach(pid => {
      if (summary[pid]) summary[pid].games++;
    });

    // Partners
    if (summary[t1[0]]) summary[t1[0]].partners[t1[1]] = (summary[t1[0]].partners[t1[1]] || 0) + 1;
    if (summary[t1[1]]) summary[t1[1]].partners[t1[0]] = (summary[t1[1]].partners[t1[0]] || 0) + 1;
    if (summary[t2[0]]) summary[t2[0]].partners[t2[1]] = (summary[t2[0]].partners[t2[1]] || 0) + 1;
    if (summary[t2[1]]) summary[t2[1]].partners[t2[0]] = (summary[t2[1]].partners[t2[0]] || 0) + 1;

    // Opponents
    t1.forEach(p1 => t2.forEach(p2 => {
      if (summary[p1]) summary[p1].opponents[p2] = (summary[p1].opponents[p2] || 0) + 1;
      if (summary[p2]) summary[p2].opponents[p1] = (summary[p2].opponents[p1] || 0) + 1;
    }));
  });

  console.log("=== PLAYER SUMMARY ===");
  players.forEach(p => {
    const s = summary[p.PlayerID];
    const uniquePartners = Object.keys(s.partners).length;
    const uniqueOpponents = Object.keys(s.opponents).length;
    const maxSamePartner = Object.values(s.partners).reduce((max, c) => Math.max(max, c), 0);
    const maxSameOpponent = Object.values(s.opponents).reduce((max, c) => Math.max(max, c), 0);

    console.log(
      `${p.PlayerID} || Games ${s.games} || Byes ${s.byes} || Unique Partners ${uniquePartners} || Unique Opponents ${uniqueOpponents} || Max Same Partner ${maxSamePartner} || Max Same Opponent ${maxSameOpponent}`
    );
  });
}

// ---------- TOP-LEVEL ENTRY POINT ----------

async function generateNRoundsAndPreview(numberOfRounds) {
  const payload = window.cachedUserUniverse;
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const courtsCount = parseInt(activeEvent.NumberofCourts) || 1;

  const startRound = 1; // always starts fresh at Round 1, ignoring any existing draw

  const players = payload.players && payload.players.length > 0
    ? payload.players
    : await window.fetchPlayersFromFirestore(activeEventId, activeEvent.CurrentPlayerVersion);
  window.cachedUserUniverse.players = players;

  console.log(`Number of players ${players.length});

  const byeSchedule = generateByeSchedule(players, numberOfRounds, courtsCount);

  const byesByRound = {};
  Object.keys(byeSchedule).forEach(i => {
    byesByRound[startRound + parseInt(i)] = byeSchedule[i];
  });

  const newMatches = generateMultipleRounds(
    players,
    [], // no existing history — every generation starts clean
    byesByRound,
    startRound,
    numberOfRounds,
    courtsCount,
    activeEventId,
    activeEvent.CurrentDrawVersion
  );

  console.log(`Generated ${newMatches.length} matches across ${numberOfRounds} round(s):`, newMatches);

  logPlayerSummary(players, newMatches, byesByRound);
  
  return newMatches;
}
