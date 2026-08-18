async function handleRedivisionBuild() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent.GameID;
  const drawVersion = activeEvent.CurrentDrawVersion; // unchanged — no version bump for redivision

  const numberOfRounds = window.rdConfig.numberOfRounds;
  const startRound = window.rdConfig.startRound;

  const allPlayers = window.cachedUserUniverse.players;
  const players = allPlayers.filter(p => p.playerExclude !== 'Yes');
  const courtsCount = Math.min(parseInt(activeEvent.NumberofCourts) || 1, Math.floor(players.length / 4) || 1);
  const userEmail = window.currentUserEmail;

  const existingMatches = window.cachedUserUniverse.draw || [];

  // History used for repeat-avoidance = only rounds BEFORE the redivision point
  // (genuinely played rounds — anything from startRound onward is being replaced)
  const historyBeforeRedivision = existingMatches.filter(m => parseInt(m.Round) < startRound);

  let newMatches;

  if (gameId === 'doubles-pro' || gameId === 'rx-sports') {
    newMatches = generateDoublesProDraw(
      players, courtsCount, activeEventId, drawVersion, userEmail,
      numberOfRounds, startRound, historyBeforeRedivision
    );

  } else if (gameId === 'teams' || gameId === 'pool-fusion') {
    // Pool Fusion's redivision follows the Teams engine going forward, per spec
    const numberOfTeams = parseInt(activeEvent.NumberOfTeams) || 2;
    let allMatches = [...historyBeforeRedivision];
    newMatches = [];
    for (let i = 0; i < numberOfRounds; i++) {
      const roundNumber = startRound + i;
      const roundMatches = generateTeamsRoundDraw(
        players, allMatches, roundNumber, courtsCount,
        activeEventId, drawVersion, userEmail, numberOfTeams
      );
      newMatches.push(...roundMatches);
      allMatches = [...allMatches, ...roundMatches];
    }

  } else {
    // Divisions, Ladder Scramble, Pools — standard clustered engine, re-anchored at startRound
    const numberOfTeams = parseInt(activeEvent.NumberOfTeams) || 1;
    const clusteredGames = ['divisions', 'ladder-scramble', 'pools'];
    const isClustered = clusteredGames.includes(gameId);

    let byesByRound;
    if (isClustered) {
      const courtsPerTeam = courtsCount / numberOfTeams;
      byesByRound = generateByeScheduleByTeam(players, numberOfRounds, courtsPerTeam);
    } else {
      const byeSchedule = generateByeSchedule(players, numberOfRounds, courtsCount);
      byesByRound = {};
      Object.keys(byeSchedule).forEach(i => {
        byesByRound[startRound + parseInt(i)] = byeSchedule[i];
      });
    }

    newMatches = generateMultipleRounds(
      players, historyBeforeRedivision, byesByRound, startRound, numberOfRounds, courtsCount,
      activeEventId, drawVersion, gameId, numberOfTeams, userEmail
    );
  }

  // Delete any existing documents for the rounds being replaced (may be none, or may be
  // a partially-played round — either way, this correctly clears the target window
  // before writing fresh matches into it)
  const targetRounds = Array.from({ length: numberOfRounds }, (_, i) => startRound + i);
  const staleMatches = existingMatches.filter(m => targetRounds.includes(parseInt(m.Round)));

  try {
    await Promise.all(staleMatches.map(m => window.deleteMatchInFirestore(m.MatchID)));
    await window.saveGeneratedDrawToFirestore(newMatches);

    // Sync local cache — drop the stale rounds, add the new ones
    window.cachedUserUniverse.draw = [
      ...existingMatches.filter(m => !targetRounds.includes(parseInt(m.Round))),
      ...newMatches
    ];

    console.log(`Redivision complete — ${staleMatches.length} old match(es) removed, ${newMatches.length} new match(es) saved for rounds ${startRound}-${startRound + numberOfRounds - 1}.`);
    alert("Redivision complete.");
    navigateToScreen('draw');
  } catch (err) {
    console.error("Redivision failed:", err);
    alert("Redivision failed — check the console for details.");
  }
}