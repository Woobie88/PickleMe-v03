window.exportDuprCsv = async function() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(
    e => String(e.EventID || e.eventId) === String(activeEventId)
  );
  if (!activeEvent) {
    alert("No active event found.");
    return;
  }

  const matches = window.cachedUserUniverse.draw && window.cachedUserUniverse.draw.length > 0
    ? window.cachedUserUniverse.draw
    : await window.fetchDrawFromFirestore(activeEventId, activeEvent.CurrentDrawVersion);

  const players = window.cachedUserUniverse.players && window.cachedUserUniverse.players.length > 0
    ? window.cachedUserUniverse.players
    : await window.fetchPlayersFromFirestore(activeEventId, activeEvent.CurrentPlayerVersion);

  const playerMap = {};
  players.forEach(p => {
    playerMap[p.PlayerID] = { name: p.Name, duprId: p.DUPRId };
  });

  // Only matches where both teams have a recorded result
  const completedMatches = matches.filter(m => m.Team1WinLoss && m.Team2WinLoss);

  if (completedMatches.length === 0) {
    alert("No completed matches to export.");
    return;
  }

  const headers = [
    'matchType',	'event',	'date',	
    'playerA1',	'playerA1DuprId',	'playerA1ExternalId',
    'playerA2',	'playerA2DuprId',	'playerA2ExternalId',
    'playerB1',	'playerB1DuprId',	'playerB1ExternalId',
    'playerB2',	'playerB2DuprId',	'playerB2ExternalId',
    'teamAGame1',	'teamBGame1',	'teamAGame2',	'teamBGame2',	'teamAGame3',	'teamBGame3',	
    'teamAGame4',	'teamBGame4',	'teamAGame5',	'teamBGame5',
    'location',	'scoreType'
  ];

  const eventDate = activeEvent.EventDate ? activeEvent.EventDate.split('T')[0] : '';

  const csvRows = [headers.join(',')];

  completedMatches.forEach(m => {
    const a1 = playerMap[m.Team1Player1] || {};
    const a2 = playerMap[m.Team1Player2] || {};
    const b1 = playerMap[m.Team2Player1] || {};
    const b2 = playerMap[m.Team2Player2] || {};

    const row = [
      'D',
      escapeCsvValue(activeEvent.EventName || ''),
      eventDate,
      escapeCsvValue(a1.name || ''),
      a1.duprId || '',
      '',
      escapeCsvValue(a2.name || ''),
      a2.duprId || '',
      '',
      escapeCsvValue(b1.name || ''),
      b1.duprId || '',
      '',
      escapeCsvValue(b2.name || ''),
      b2.duprId || '',
      '',
      m.Team1Score || '',
      m.Team2Score || '',
      '', '', '', '', '', '', '', '', // Game 2-5 left blank
      escapeCsvValue(activeEvent.EventLocation || ''),
      'SIDEOUT'
    ];

    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\n');
  const filename = `dupr-export-${eventDate || 'event'}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function escapeCsvValue(val) {
  val = String(val);
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}
