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
    const foundNames = parseAttendeeNames(rawText);

    // Ensure duprDatabase is loaded
    const duprDatabase = window.cachedUserUniverse.dupr && window.cachedUserUniverse.dupr.length > 0
      ? window.cachedUserUniverse.dupr
      : await window.fetchDuprDatabaseFromFirestore(); // see note below
    window.cachedUserUniverse.dupr = duprDatabase;

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
    return { DUPRId: candidates[0].DUPRId, DUPR: parseFloat(candidates[0].DUPR) || 2.0 };
  }

  // Multiple matches — pick the one with the highest DUPR Reliability
  const best = candidates.reduce((highest, current) => {
    const currentReliability = parseFloat(current.Reliability) || 0;
    const highestReliability = parseFloat(highest.Reliability) || 0;
    return currentReliability > highestReliability ? current : highest;
  });

  return { DUPRId: best.DUPRId, DUPR: parseFloat(best.DUPR) || 2.0 };
}
