/**
 * ============================================================
 * SHARED EVENT TIMER
 * One countdown per event, stored on the event document and delivered to
 * every device by the live event listener (see applyLiveEventUpdate in
 * eventCards.js). The main PickleMe app controls it; every app shows it.
 *
 * Fields on the events/{id} document:
 *   TimerStatus       'off' | 'running' | 'paused'
 *   TimerDurationMs   length originally set (ms)
 *   TimerEndsAt       when it hits zero, in SERVER time (epoch ms) — running only
 *   TimerRemainingMs  time left (ms) — paused only
 *
 * Everyone computes remaining time as  TimerEndsAt - serverNow(),  so devices
 * stay in step even if their own clocks are a little off.
 * ============================================================
 */

// ---------- SERVER CLOCK ----------

window.serverClockOffset = 0; // serverTime - deviceTime, in ms

/** Measures the gap between this device's clock and Firestore's. Falls back to 0 on any failure. */
async function syncServerClock() {
  try {
    if (!window.currentUserId || !window.getServerClockOffset) return;
    window.serverClockOffset = await window.getServerClockOffset(window.currentUserId);
    console.log("Server clock offset (ms):", Math.round(window.serverClockOffset));
  } catch (err) {
    console.warn("Server clock sync failed, using device clock:", err);
    window.serverClockOffset = 0;
  }
}

function serverNow() {
  return Date.now() + (window.serverClockOffset || 0);
}

// ---------- STATE ----------

function getTimerEvent() {
  const cache = window.cachedUserUniverse;
  if (!cache) return null;
  return cache.events.find(e => String(e.EventID || e.eventId) === String(cache.activeEventId)) || null;
}

function canControlTimer() {
  return window.currentAppName === 'pickleMe';
}

/** Turns the event's timer fields into { status, remaining, finished }. */
function getTimerState(ev) {
  const status = ev?.TimerStatus || 'off';
  if (status === 'off') return { status: 'off', remaining: 0, finished: false };

  if (status === 'paused') {
    return { status: 'paused', remaining: Math.max(0, Number(ev.TimerRemainingMs) || 0), finished: false };
  }

  const remaining = Math.max(0, (Number(ev.TimerEndsAt) || 0) - serverNow());
  return { status: 'running', remaining, finished: remaining <= 0 };
}

function formatTimerMs(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ---------- DISPLAY ----------

let timerInterval = null;
let timerWasRunningLastTick = false;
window.timerDismissedEndsAt = null; // lets a viewer hide a finished timer on their own device

/** Call whenever the timer fields might have changed (event load, live update, local action). */
function refreshEventTimer() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);

  clearInterval(timerInterval);
  timerInterval = null;

  if (state.status === 'running' && !state.finished) {
    timerWasRunningLastTick = true;
    timerInterval = setInterval(tickEventTimer, 250);
  } else {
    timerWasRunningLastTick = false;
  }

  renderTimerPill(ev, state);
  renderTimerSheet(ev, state);
}

function tickEventTimer() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);

  if (state.finished && timerWasRunningLastTick) {
    // Just crossed zero while we were watching: buzz once, then stop ticking
    timerWasRunningLastTick = false;
    clearInterval(timerInterval);
    timerInterval = null;
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
    renderTimerPill(ev, state);
    renderTimerSheet(ev, state);
    return;
  }

  updateTimerDigits(state);
}

function renderTimerPill(ev, state) {
  const pill = document.getElementById('timer-pill');
  const text = document.getElementById('timer-pill-text');
  if (!pill || !text) return;

  const dismissed = state.finished && window.timerDismissedEndsAt === ev?.TimerEndsAt;
  if (state.status === 'off' || dismissed) {
    pill.hidden = true;
    return;
  }

  pill.hidden = false;
  pill.classList.toggle('timer-warning', state.status === 'running' && !state.finished && state.remaining <= 60000);
  pill.classList.toggle('timer-finished', state.finished);
  pill.classList.toggle('timer-paused', state.status === 'paused');
  text.innerText = state.finished ? "TIME!" : formatTimerMs(state.remaining);
}

/** Cheap per-tick update: only the numbers, never the buttons. */
function updateTimerDigits(state) {
  const text = document.getElementById('timer-pill-text');
  if (text) text.innerText = state.finished ? "TIME!" : formatTimerMs(state.remaining);

  const big = document.getElementById('timer-big-text');
  if (big) big.innerText = state.finished ? "TIME!" : formatTimerMs(state.remaining);

  document.getElementById('timer-pill')?.classList.toggle('timer-warning', !state.finished && state.remaining <= 60000);
}

// ---------- SHEET (bottom overlay) ----------

function openTimerSheet() {
  const ev = getTimerEvent();
  renderTimerSheet(ev, getTimerState(ev));
  document.getElementById('timer-overlay')?.classList.add('open');
}

function closeTimerSheet() {
  document.getElementById('timer-overlay')?.classList.remove('open');
}

function renderTimerSheet(ev, state) {
  const body = document.getElementById('timer-body-content');
  if (!body) return;

  const bigText = state.status === 'off' ? '--:--' : (state.finished ? 'TIME!' : formatTimerMs(state.remaining));
  const stateClass = state.finished ? 'timer-finished' : (state.status === 'paused' ? 'timer-paused' : '');

  let html = `<div class="timer-big ${stateClass}" id="timer-big-text">${bigText}</div>`;

  if (state.status === 'paused') html += `<p class="timer-status-line">Paused</p>`;
  if (state.status === 'off') html += `<p class="timer-status-line">No timer running for this event</p>`;

  if (canControlTimer()) {
    if (state.status === 'off') {
      html += `
        <h3>Set Timer</h3>
        <div class="timer-presets">
          ${[5, 8, 10, 12, 15, 20].map(m => `<button class="timer-chip" onclick="document.getElementById('timer-custom-min').value = ${m}">${m} min</button>`).join('')}
        </div>
        <div class="timer-custom">
          <input type="number" id="timer-custom-min" min="1" max="180" value="${ev?.MatchTime || 10}" inputmode="numeric">
          <span>minutes</span>
        </div>
        <button class="timer-btn primary" onclick="timerStart()">Start Timer</button>
      `;
    } else {
      html += `<div class="timer-actions">`;
      if (state.status === 'running' && !state.finished) {
        html += `<button class="timer-btn" onclick="timerPause()">Pause</button>`;
      } else if (state.status === 'paused') {
        html += `<button class="timer-btn primary" onclick="timerResume()">Resume</button>`;
      }
      if (!state.finished) html += `<button class="timer-btn" onclick="timerAddMinute()">+1 min</button>`;
      html += `<button class="timer-btn danger" onclick="timerStop()">${state.finished ? 'Clear Timer' : 'Stop'}</button>`;
      html += `</div>`;
    }
  } else if (state.finished) {
    html += `<div class="timer-actions"><button class="timer-btn" onclick="timerDismissLocal()">Dismiss</button></div>`;
  } else if (state.status !== 'off') {
    html += `<p class="timer-status-line">Controlled from the main PickleMe app</p>`;
  }

  body.innerHTML = html;
}

// ---------- CONTROLS (main PickleMe app only) ----------

/** Updates the local cache straight away, then writes to Firestore for everyone else. */
function writeTimer(fields) {
  if (!canControlTimer()) return;
  const ev = getTimerEvent();
  if (!ev) return;

  Object.assign(ev, fields);
  window.timerDismissedEndsAt = null;
  refreshEventTimer();

  window.updateEventInFirestore(ev.EventID, fields)
    .then(() => console.log("Timer saved:", fields.TimerStatus))
    .catch(err => console.error("Failed to save timer:", err));
}

function timerStart() {
  const minutes = parseFloat(document.getElementById('timer-custom-min')?.value);
  if (!minutes || minutes <= 0) {
    alert("Enter the number of minutes first.");
    return;
  }
  const durationMs = Math.round(minutes * 60000);
  writeTimer({
    TimerStatus: 'running',
    TimerDurationMs: durationMs,
    TimerEndsAt: serverNow() + durationMs,
    TimerRemainingMs: durationMs
  });
}

function timerPause() {
  const state = getTimerState(getTimerEvent());
  if (state.status !== 'running') return;
  writeTimer({ TimerStatus: 'paused', TimerEndsAt: null, TimerRemainingMs: state.remaining });
}

function timerResume() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);
  if (state.status !== 'paused') return;
  writeTimer({ TimerStatus: 'running', TimerEndsAt: serverNow() + state.remaining, TimerRemainingMs: state.remaining });
}

function timerAddMinute() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);
  if (state.status === 'running') {
    writeTimer({ TimerEndsAt: Number(ev.TimerEndsAt) + 60000 });
  } else if (state.status === 'paused') {
    writeTimer({ TimerRemainingMs: state.remaining + 60000 });
  }
}

function timerStop() {
  writeTimer({ TimerStatus: 'off', TimerEndsAt: null, TimerRemainingMs: null });
}

/** Viewer-only: hide a finished timer on this device without touching anyone else's. */
function timerDismissLocal() {
  const ev = getTimerEvent();
  window.timerDismissedEndsAt = ev?.TimerEndsAt ?? null;
  closeTimerSheet();
  refreshEventTimer();
}

// Coming back to the app after it was backgrounded: catch up immediately
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshEventTimer();
});