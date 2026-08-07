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

    window.osPhotoCount++;
    const beforeCount = window.osScannedNames.length;
    window.osScannedNames = mergeNewNames(window.osScannedNames, foundNames);
    const newUniqueCount = window.osScannedNames.length - beforeCount;

    renderOsScanSummary(foundNames.length, newUniqueCount);

  } catch (err) {
    console.error("OCR failed:", err);
    statusEl.innerHTML = `<h3>Could not read image</h3><p>Try a clearer photo, then scan again</p>`;
  }

  event.target.value = ''; // reset file input so the same photo could be re-selected if needed
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
