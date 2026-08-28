/**
 * ============================================================
 * PLAYOFFS: 1 & 2 ROUND ENGINE
 *
 * 1 round (Final only): players grouped into courts by standings
 * rank (Court 1 = top ranks), DUPR-balanced 2v2 within each
 * group. Leftover players who don't fill a complete court of 4
 * are eliminated.
 *
 * 2 rounds (Elimination Final + Final): same rank-based grouping
 * for EF. Two DIFFERENT advancement rules depending on whether
 * byes exist:
 *   - No byes (groups divide evenly by 4): winning/losing DOUBLES
 *     TEAMS advance/drop intact — Final Court 1 = EF winners from
 *     both courts, Final Court 2 = EF losers from both courts.
 *   - Byes exist (uneven groups): individual players are re-ranked
 *     within their own EF court after results, using updated
 *     ladder points. Each court keeps its bye + as many top-ranked
 *     EF players as fit; leftover drops to the court below (or is
 *     eliminated if it's the bottom court).
 *
 * Verified against 2 EF-court examples (8 players/no-bye and
 * 10 players/with-bye). NOT yet verified for 3+ EF courts.
 * ============================================================
 */

function getStandingsRankedPlayers(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes');
  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

  const ranked = rankPlayersByLadderCriteria(players, matches, ladderScoringMode); // CHANGED
  return ranked.map(r => r.player);
}

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

// ---------- 1 ROUND: FINAL ONLY ----------

function generatePlayoffFinalRound(payload, roundNumber, eventId, drawVersion, userEmail) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const courtsCount = Math.ceil(rankedPlayers.length / 4);

  const matches = [];
  for (let c = 0; c < courtsCount; c++) {
    const courtPlayers = rankedPlayers.slice(c * 4, c * 4 + 4);
    if (courtPlayers.length < 4) {
      console.log(`Eliminated (insufficient players for a full court): ${courtPlayers.map(p => p.PlayerID).join(', ')}`);
      break;
    }

    const courtNumber = c + 1;
    const pairing = bestBalancedPairing(courtPlayers);
    matches.push(buildMatchRecord(
        { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
        0, roundNumber, eventId, drawVersion, userEmail, "Final" // ADDED
        ));
  }

  return matches;
}

// ---------- 2 ROUNDS: ELIMINATION FINAL + FINAL ----------

function computePlayoffGroups(rankedPlayers, courtsCount) {
  const n = rankedPlayers.length;
  const base = Math.floor(n / courtsCount);
  const remainder = n % courtsCount;
  const groupSizes = Array.from({ length: courtsCount }, (_, i) => base + (i < remainder ? 1 : 0));

  const groups = [];
  let cursor = 0;
  groupSizes.forEach(size => {
    const group = rankedPlayers.slice(cursor, cursor + size);
    cursor += size;
    const byeCount = Math.max(0, group.length - 4);
    const byes = group.slice(0, byeCount);
    const efPlayers = group.slice(byeCount);
    groups.push({ byes, efPlayers });
  });

  return groups;
}

function generatePlayoffEliminationRound(payload, roundNumber, eventId, drawVersion, userEmail) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const courtsCount = Math.min(
    parseInt(payload.events.find(e => String(e.EventID) === String(payload.activeEventId)).NumberofCourts) || 1,
    Math.ceil(rankedPlayers.length / 4)
  );

  const groups = computePlayoffGroups(rankedPlayers, courtsCount);
  window.playoffGroupsCache = groups; // needed by the Final-round generator afterward

  const matches = [];
  groups.forEach((group, idx) => {
    if (group.efPlayers.length < 4) return; // shouldn't happen given computePlayoffGroups' logic, safety check
    const courtNumber = idx + 1;
    const pairing = bestBalancedPairing(group.efPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
        0, roundNumber, eventId, drawVersion, userEmail, "Elimination Final" // ADDED
    ));
  });

  return matches;
}

function generatePlayoffFinalAfterElimination(payload, efMatches, roundNumber, eventId, drawVersion, userEmail) {
  const groups = window.playoffGroupsCache;
  if (!groups) {
    console.error("No cached EF groups found — cannot build Final round.");
    return [];
  }

  const hasAnyByes = groups.some(g => g.byes.length > 0);

  let finalGroups;

  if (!hasAnyByes) {
    // TEAM-INTACT MERGE: only verified for exactly 2 EF courts
    if (groups.length !== 2) {
      console.warn("Team-intact merge only verified for 2 EF courts — proceeding with best-effort logic for other counts.");
    }
    const efResults = efMatches.map(m => {
      const winners = m.Team1WinLoss === 'Win' ? [m.Team1Player1, m.Team1Player2] : [m.Team2Player1, m.Team2Player2];
      const losers = m.Team1WinLoss === 'Loss' ? [m.Team1Player1, m.Team1Player2] : [m.Team2Player1, m.Team2Player2];
      return { winners, losers };
    });

    finalGroups = [
      [...efResults[0].winners, ...efResults[1].winners],
      [...efResults[0].losers, ...efResults[1].losers]
    ];

  } else {
    // INDIVIDUAL-RANKING CASCADE: only verified for exactly 2 EF courts
    const postEfRanks = groups.map((group, idx) => {
      const courtEfPlayerIds = group.efPlayers.map(p => p.PlayerID);
      const rankedWithinCourt = courtEfPlayerIds
        .map(pid => {
          const stats = calculatePlayerStats(pid, efMatches);
          const activeEvent = payload.events.find(e => String(e.EventID) === String(payload.activeEventId));
          const points = calculateLadderPoints(stats, activeEvent.LadderScoring || 'Margin');
          return { pid, points };
        })
        .sort((a, b) => b.points - a.points)
        .map(r => r.pid);
      return rankedWithinCourt;
    });

    const finalGroupsIds = groups.map(g => [...g.byes.map(p => p.PlayerID)]);
    let incoming = [];

    for (let c = 0; c < groups.length; c++) {
      const isLast = c === groups.length - 1;
      const ranked = [...postEfRanks[c]];

      finalGroupsIds[c].push(...incoming);

      const slotsAvailable = 4 - finalGroupsIds[c].length;
      const keepCount = Math.min(slotsAvailable, ranked.length);
      const kept = ranked.slice(0, keepCount);
      finalGroupsIds[c].push(...kept);

      incoming = isLast ? [] : ranked.slice(keepCount);
    }

    finalGroups = finalGroupsIds;
  }

  const allPlayersById = {};
  payload.players.forEach(p => { allPlayersById[p.PlayerID] = p; });

  const matches = [];
  finalGroups.forEach((groupIds, idx) => {
    if (groupIds.length < 4) return;
    const courtNumber = idx + 1;
    const groupPlayers = groupIds.map(pid => allPlayersById[pid]);
    const pairing = bestBalancedPairing(groupPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
        0, roundNumber, eventId, drawVersion, userEmail, "Final" // ADDED
    ));
  });

  return matches;
}

async function handlePlayoffFinalAdvance() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const payload = window.cachedUserUniverse;
  const drawVersion = activeEvent.CurrentDrawVersion;
  const userEmail = window.currentUserEmail;

  const efRound = activeEvent.PlayoffEFRound;
  const finalRound = activeEvent.PlayoffFinalRound;

  const efMatches = (payload.draw || []).filter(m => parseInt(m.Round) === efRound);

  if (!isRoundComplete(payload.draw, efRound)) {
    alert("Enter results for every Elimination Final match before advancing to the Final.");
    return false;
  }

  const newMatches = generatePlayoffFinalAfterElimination(payload, efMatches, finalRound, activeEventId, drawVersion, userEmail);

  if (!newMatches || newMatches.length === 0) {
    console.error("Failed to generate Final round matches.");
    alert("Could not generate the Final round — check the console for details.");
    return false;
  }

  try {
    await window.saveGeneratedDrawToFirestore(newMatches);
    window.cachedUserUniverse.draw = [...(payload.draw || []), ...newMatches];
    console.log(`Playoffs Final generated (Round ${finalRound}): ${newMatches.length} match(es).`);
    return true;
  } catch (err) {
    console.error("Failed to save Final round matches:", err);
    alert("Failed to save the Final round — check the console for details.");
    return false;
  }
}

/**
 * ============================================================
 * PLAYOFFS: 3 & 4-ROUND PROGRESSIVE BRACKET
 * 4 rounds = Qualifying Final, Semi Final, Elimination Final, Final
 * 3 rounds = Semi Final, Elimination Final, Final (identical
 * mechanism, just starts one stage later)
 *
 * Round 1 of the bracket is rank-based (top-ranked players fill
 * Court 1 cascading down), with randomly-chosen byes each round.
 * Every subsequent round reuses the verified Progressive engine
 * (Kings & Queens or Snakes & Ladders, via toggle) — independent
 * of the event's actual GameID. Each round only generates once
 * the prior round's results are entered, visible on swipe.
 * ============================================================
 */

window.playoffProgressionType = 'kings-queens';

function setPlayoffProgressionType(type) {
  window.playoffProgressionType = type;
  document.querySelectorAll('#po-progression-toggle .scoring-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === type);
  });
}

function pickRandomByes(activePlayers, byesNeeded) {
  const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, byesNeeded).map(p => p.PlayerID);
}

/**
 * Builds the FIRST round of a 3 or 4-round progressive bracket —
 * rank-based, top-ranked players cascade into Court 1 downward.
 * roundsValue determines the label (PLAYOFF_ROUND_NAMES[roundsValue][0]) —
 * "Semi Final" for 3 rounds, "Qualifying Final" for 4 rounds.
 */
function generatePlayoffProgressiveRound1(payload, roundsValue, roundNumber, eventId, drawVersion, userEmail) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const courtsCount = Math.floor(rankedPlayers.length / 4);
  const byesNeeded = rankedPlayers.length - courtsCount * 4;

  const byeIds = pickRandomByes(rankedPlayers, byesNeeded);
  const activePlayers = rankedPlayers.filter(p => !byeIds.includes(p.PlayerID));

  const roundLabel = PLAYOFF_ROUND_NAMES[roundsValue][0]; // CHANGED — parameterized, was hardcoded "Qualifying Final"

  const matches = [];
  for (let c = 0; c < courtsCount; c++) {
    const courtPlayers = activePlayers.slice(c * 4, c * 4 + 4);
    const courtNumber = c + 1;
    const pairing = bestBalancedPairing(courtPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
      0, roundNumber, eventId, drawVersion, userEmail, roundLabel
    ));
  }

  return matches;
}

/**
 * Builds a minimal placeholder round purely to encode "who's on bye"
 * for advanceProgressiveRound's getByePlayersForRound lookup — the
 * actual pairings here are thrown away and overwritten by the real
 * progression logic, so any valid pairing of the active players works.
 */
function buildPlayoffPlaceholderRound(activePlayers, courtsCount, roundNumber, eventId, drawVersion, userEmail) {
  const courtNumbers = Array.from({ length: courtsCount }, (_, i) => i + 1);
  const matches = [];
  for (let c = 0; c < courtsCount; c++) {
    const courtPlayers = activePlayers.slice(c * 4, c * 4 + 4);
    if (courtPlayers.length < 4) break;
    matches.push(buildMatchRecord(
      { teamA: [courtPlayers[0], courtPlayers[1]], teamB: [courtPlayers[2], courtPlayers[3]], court: courtNumbers[c] },
      0, roundNumber, eventId, drawVersion, userEmail
    ));
  }
  return matches;
}

function generatePlayoffPlaceholderForRound(payload, roundNumber, eventId, drawVersion, userEmail) {
  const activeEvent = payload.events.find(e => String(e.EventID) === String(eventId));
  const activePlayers = payload.players.filter(
    p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes'
  );

  const courtsCount = Math.floor(activePlayers.length / 4);
  const byesNeeded = activePlayers.length - courtsCount * 4;
  const byeIds = pickRandomByes(activePlayers, byesNeeded);
  const roundActivePlayers = activePlayers.filter(p => !byeIds.includes(p.PlayerID));

  return buildPlayoffPlaceholderRound(roundActivePlayers, courtsCount, roundNumber, eventId, drawVersion, userEmail);
}