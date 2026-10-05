function renderAddEventDetailScreen() {
  document.getElementById('ae-event-name').value = '';
  document.getElementById('ae-event-location').value = '';

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('ae-event-date').value = `${yyyy}-${mm}-${dd}`;

  document.getElementById('ae-courts-value').innerText = 1;
  document.getElementById('ae-event-courts').value = 1;

  document.getElementById('ae-dupr-value').innerText = 0;
  document.getElementById('ae-event-dupr').value = 0;
}

function adjustAeCourts(direction) {
  const hiddenInput = document.getElementById('ae-event-courts');
  const displaySpan = document.getElementById('ae-courts-value');
  let current = parseInt(hiddenInput.value) || 1;
  current = Math.max(1, current + direction);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}

function adjustAeDuprLimit(direction) {
  const hiddenInput = document.getElementById('ae-event-dupr');
  const displaySpan = document.getElementById('ae-dupr-value');
  let current = parseFloat(hiddenInput.value) || 0;

  if (direction > 0) {
    current = current === 0 ? 2 : Math.round((current + 0.25) * 100) / 100;
  } else {
    if (current > 2) current = Math.round((current - 0.25) * 100) / 100;
    else if (current === 2) current = 0;
  }

  current = Math.max(0, current);
  hiddenInput.value = current;
  displaySpan.innerText = current;
}