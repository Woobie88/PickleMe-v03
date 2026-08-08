// Menu toggle for adding players
function toggleAddPlayersFabMenu() {
  const menu = document.getElementById('add-players-fab-menu');
  const plusIcon = document.getElementById('add-players-plus-icon');
  const xIcon = document.getElementById('add-players-x-icon');
  const label = document.getElementById('add-players-main-label');

  const isOpen = menu.classList.toggle('open');

  plusIcon.style.display = isOpen ? 'none' : 'block';
  xIcon.style.display = isOpen ? 'block' : 'none';
  label.style.display = isOpen ? 'none' : 'block';
}

function handleAddPlayersAction(action) {
  toggleAddPlayersFabMenu(); // close the menu after a selection

  switch (action) {
    case 'opensports':
      window.osScannedNames = [];
      window.osPhotoCount = 0;
      navigateToScreen('opensports-import');
      resetOpenSportsImportUI(); // NEW
      break;
    case 'individual':
      console.log('Individual add selected');
      // next: navigate to the manual single-player form screen
      break;
  }
}

// Scanning image from OpenSports
window.osScannedNames = []; // running deduped list across all photos this session
window.osPhotoCount = 0;

function triggerOsImageUpload() {
  document.getElementById('os-image-input').click();
}

async function handleOpenSportsImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('os-scan-status');
  statusEl.innerHTML = `<h3>Reading image...</h3><p>This may take a few seconds</p>`;

  try {
    const result = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          statusEl.innerHTML = `<h3>Reading image... ${Math.round(m.progress * 100)}%</h3>`;
        }
      }
    });

    const rawText = result.data.text;
    alert("OCR raw text: " + rawText.substring(0, 300)); // show first 300 chars
    const foundNames = parseAttendeeNames(rawText);
    alert("Parsed names: " + JSON.stringify(foundNames));

    const duprDatabase = window.cachedUserUniverse.dupr && window.cachedUserUniverse.dupr.length > 0
      ? window.cachedUserUniverse.dupr
      : await window.fetchDuprDatabaseFromFirestore();
      alert("DUPR database loaded: " + duprDatabase.length + " records");

    // Attach DUPR match to each found name
    const namesWithDupr = foundNames.map(name => {
      const match = findBestDuprMatch(name, duprDatabase);
      return { name, DUPRId: match.DUPRId, DUPR: match.DUPR };
    });

    window.osPhotoCount++;
    const beforeCount = window.osScannedNames.length;
    window.osScannedNames = mergeNewNamesWithDupr(window.osScannedNames, namesWithDupr);
    const newUniqueCount = window.osScannedNames.length - beforeCount;

    renderOsScanSummary(foundNames.length, newUniqueCount);

  } catch (err) {
    console.error("OCR failed:", err);
    statusEl.innerHTML = `<h3>Could not read image</h3><p>Try a clearer photo, then scan again</p>`;
  }

  event.target.value = '';
}

function mergeNewNamesWithDupr(existingEntries, newEntries) {
  const existingNormalized = new Set(existingEntries.map(e => normalizeNameForDedup(e.name)));
  const merged = [...existingEntries];

  newEntries.forEach(entry => {
    const normalized = normalizeNameForDedup(entry.name);
    if (!existingNormalized.has(normalized)) {
      merged.push(entry);
      existingNormalized.add(normalized);
    }
  });

  return merged;
}
function renderOsScanSummary(foundThisPhoto, newUniqueThisPhoto) {
  const statusEl = document.getElementById('os-scan-status');
  const summaryEl = document.getElementById('os-scanned-summary');
  const reviewBar = document.getElementById('os-review-bar');

  statusEl.style.display = 'none';
  summaryEl.style.display = 'flex';

  const duplicateCount = foundThisPhoto - newUniqueThisPhoto;

  summaryEl.innerHTML += `
    <div class="app-card" style="cursor: default;">
      <div class="card-content">
        <h3>Photo ${window.osPhotoCount}</h3>
        <p class="card-meta-line">${foundThisPhoto} names found ${duplicateCount > 0 ? `|| ${duplicateCount} already in list` : ''}</p>
      </div>
    </div>
  `;

  document.getElementById('os-name-count').innerText = window.osScannedNames.length;
  reviewBar.style.display = 'flex';
}

function goToOpenSportsReview() {
  navigateToScreen('opensports-review');
}

// Matching OCR to DUPR database
function normalizeNameForMatching(name) {
  return name
    .toLowerCase()
    .replace(/[-'\s]/g, ''); // strip hyphens, apostrophes, and all whitespace entirely
}

function findBestDuprMatch(scannedName, duprDatabase) {
  const targetNormalized = normalizeNameForMatching(scannedName);

  const candidates = duprDatabase.filter(d => 
    normalizeNameForMatching(d.Name || '') === targetNormalized
  );

  if (candidates.length === 0) {
    return { DUPRId: 'Not Found', DUPR: 2.0 };
  }

  if (candidates.length === 1) {
    return { DUPRId: candidates[0].DUPRId, DUPR: parseFloat(candidates[0]["DUPR Rating"]) || 2.0 };
  }

  // Multiple matches — pick the one with the highest DUPR Reliability
  const best = candidates.reduce((highest, current) => {
    const currentReliability = parseFloat(current["DUPR Reliability"]) || 0;
    const highestReliability = parseFloat(highest["DUPR Reliability"]) || 0;
    return currentReliability > highestReliability ? current : highest;
  });

  return { DUPRId: best.DUPRId, DUPR: parseFloat(best["DUPR Rating"]) || 2.0 };
}

function parseAttendeeNames(rawText) {
  const STOPLIST = new Set([
    "display settings", "check in", "check-in", "no shows",
    "search by name or registration option", "attendees", "waitlist"
  ]);

  function extractName(line) {
    if (/checked-?in by/i.test(line)) return null;

    const words = line.split(/\s+/);
    const nameWords = [];

    for (let i = words.length - 1; i >= 0; i--) {
      const clean = words[i].replace(/[.,;:]/g, '');
      if (/^[A-Z][a-zA-Z'-]{1,}$/.test(clean)) {
        nameWords.unshift(clean);
      } else {
        break;
      }
    }

    if (nameWords.length < 2) return null;

    const candidate = nameWords.join(' ');
    if (candidate === candidate.toUpperCase()) return null;
    if (STOPLIST.has(candidate.toLowerCase())) return null;

    return candidate;
  }

  return rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 1)
    .map(line => extractName(line))
    .filter(name => name !== null);
}

function normalizeNameForDedup(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function renderOpenSportsReview() {
  const container = document.getElementById('os-review-list');

  if (window.osScannedNames.length === 0) {
    container.innerHTML = `<div class="no-data-placeholder"><h3>No Names To Review</h3></div>`;
    document.getElementById('os-import-count').innerText = '0';
    return;
  }

  container.innerHTML = window.osScannedNames.map((entry, idx) => {
    const isNotFound = entry.DUPRId === 'Not Found';
    return `
      <div class="os-review-card">
        <div class="os-review-row">
          <input type="text" class="os-review-input" value="${entry.name}" oninput="updateOsReviewField(${idx}, 'name', this.value)">
          <button class="os-remove-btn" onclick="removeOsReviewEntry(${idx})">✕</button>
        </div>
        <div class="os-review-row">
          <input type="text" class="os-review-input ${isNotFound ? 'not-found' : ''}" value="${entry.DUPRId}" oninput="updateOsReviewField(${idx}, 'DUPRId', this.value)" placeholder="DUPR ID">
          <input type="number" step="0.01" class="os-review-input ${isNotFound ? 'not-found' : ''}" value="${entry.DUPR}" oninput="updateOsReviewField(${idx}, 'DUPR', this.value)" placeholder="DUPR Rating">
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('os-import-count').innerText = window.osScannedNames.length;
}

function updateOsReviewField(index, field, value) {
  if (window.osScannedNames[index]) {
    window.osScannedNames[index][field] = field === 'DUPR' ? parseFloat(value) || 0 : value;
  }
}

function removeOsReviewEntry(index) {
  window.osScannedNames.splice(index, 1);
  renderOpenSportsReview();
}

async function commitOpenSportsImport() {
  if (window.osScannedNames.length === 0) {
    alert("No players to import.");
    return;
  }

  const payload = window.cachedUserUniverse;
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const currentPlayerVersion = parseInt(activeEvent.CurrentPlayerVersion) || 0;

  const newPlayers = window.osScannedNames.map(entry => {
    const nameParts = entry.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';

    return {
      PlayerID: generatePlayerId(),
      EventID: activeEventId,
      PlayerVersion: currentPlayerVersion,
      Name: entry.name,
      FirstName: firstName,
      DUPRId: entry.DUPRId,
      DUPR: entry.DUPR,
      Seed: 0,
      RandomNumber: Math.random(),
      Team: null,
      playerExclude: 'No',
      byeOrder: null
    };
  });

  try {
    await window.saveGeneratedPlayersToFirestore(newPlayers);
    window.cachedUserUniverse.players = [...(payload.players || []), ...newPlayers];

    alert(`Imported ${newPlayers.length} player(s) successfully.`);
    window.osScannedNames = [];
    window.osPhotoCount = 0;
    resetOpenSportsImportUI();
    navigateToScreen('players');
  } catch (err) {
    console.error("Failed to import players:", err);
    alert("Import failed — check the console for details.");
  }
}

function generatePlayerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function resetOpenSportsImportUI() {
  const statusEl = document.getElementById('os-scan-status');
  const summaryEl = document.getElementById('os-scanned-summary');
  const reviewBar = document.getElementById('os-review-bar');

  statusEl.style.display = '';
  statusEl.innerHTML = `<h3>No Photos Scanned Yet</h3><p>Tap below to scan your first screenshot</p>`;

  summaryEl.style.display = 'none';
  summaryEl.innerHTML = '';

  reviewBar.style.display = 'none';
}