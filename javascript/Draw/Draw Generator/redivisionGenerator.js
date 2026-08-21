async function handleRedivisionBuild() {
  window.gdRedivisionCache = {}; // NEW — forces fresh schedules for the CURRENT post-redivision player membership

  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const gameId = activeEvent.GameID;
  const drawVersion = activeEvent.CurrentDrawVersion;

  const numberOfRounds = window.rdConfig.numberOfRounds;
  const startRound = window.rdConfig.startRound;

  const allPlayers = window.cachedUserUniverse.players;
  const players = allPlayers.filter(p => p.playerExclude !== 'Yes');
  const courtsCount = Math.min(parseInt(activeEvent.NumberofCourts) || 1, Math.floor(players.length / 4) || 1);
  const userEmail = window.currentUserEmail;

  const existingMatches = window.cachedUserUniverse.draw || [];
  const historyBeforeRedivision = existingMatches.filter(m => parseInt(m.Round) < startRound);

  let newMatches;

  if (gameId === 'doubles-pro' || gameId === 'rx-sports') {
    newMatches = generateDoublesProDraw(
      players, courtsCount, activeEventId, drawVersion, userEmail,
      numberOfRounds, startRound, historyBeforeRedivision
    );

  } else if (gameId === 'teams' || gameId === 'pool-fusion') {
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
    const numberOfTeams = parseInt(activeEvent.NumberOfTeams) || 1;
    const clusteredGames = ['divisions', 'ladder-scramble', 'pools'];
    const isClustered = clusteredGames.includes(gameId);
    const gameProfile = gamesProfile.find(g => g.GameID === gameId); // NEW — this was never computed here at all

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
      activeEventId, drawVersion, gameId, numberOfTeams, userEmail, gameProfile // ADDED gameProfile
    );
  }

  const targetRounds = Array.from({ length: numberOfRounds }, (_, i) => startRound + i);
  const staleMatches = existingMatches.filter(m => targetRounds.includes(parseInt(m.Round)));

  try {
    await Promise.all(staleMatches.map(m => window.deleteMatchInFirestore(m.MatchID)));
    await window.saveGeneratedDrawToFirestore(newMatches);

    window.cachedUserUniverse.draw = [
      ...existingMatches.filter(m => !targetRounds.includes(parseInt(m.Round))),
      ...newMatches
    ];

    activeEvent.CurrentRound = startRound;
    await window.updateEventFieldInFirestore(activeEventId, 'CurrentRound', startRound);
    window.currentRoundNumber = startRound;

    console.log(`Redivision complete — ${staleMatches.length} old match(es) removed, ${newMatches.length} new match(es) saved for rounds ${startRound}-${startRound + numberOfRounds - 1}. CurrentRound set to ${startRound}.`);

    // NEW — log per-player stats for the newly generated rounds, same format used elsewhere
    const targetRoundByes = {};
    targetRounds.forEach(r => {
      const roundMatches = newMatches.filter(m => parseInt(m.Round) === r);
      const playingIds = new Set();
      roundMatches.forEach(m => {
        [m.Team1Player1, m.Team1Player2, m.Team1Player3, m.Team1Player4,
         m.Team2Player1, m.Team2Player2, m.Team2Player3, m.Team2Player4]
          .filter(Boolean).forEach(pid => playingIds.add(pid));
      });
      targetRoundByes[r] = players.filter(p => !playingIds.has(p.PlayerID)).map(p => p.PlayerID);
    });
    logPlayerSummary(players, newMatches, targetRoundByes);

    alert("Redivision complete.");
    navigateToScreen('draw');
  } catch (err) {
    console.error("Redivision failed:", err);
    alert("Redivision failed — check the console for details.");
  }
}