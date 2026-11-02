/**
 * ============================================================
 * SHARED EVENT TIMER (bottom bar)
 * Tapping the Timer icon in the Draw FAB menu creates a countdown of
 * events.MatchTime minutes. It appears as a bar above the bottom nav on
 * every screen, on every device using that event, with Start / Stop / Reset.
 * The last 30 seconds turn red, and at zero the alarm sounds.
 *
 * State lives on the event document and is delivered to every device by the
 * live event listener (see applyLiveEventUpdate in eventCards.js):
 *   TimerStatus       'off' | 'running' | 'paused'
 *   TimerDurationMs   length of the countdown (MatchTime * 60000 when created/reset)
 *   TimerEndsAt       when it hits zero, in SERVER time (epoch ms) — running only
 *   TimerRemainingMs  time left (ms) — paused only
 *
 * "Ready" = paused with the full duration left. "Stopped" = paused part-way.
 * Only the main PickleMe app can create/start/stop/reset (see canControlTimer);
 * every app shows the bar.
 * ============================================================
 */

const TIMER_WARNING_MS = 30000;   // bar turns red inside the last 30 seconds

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

// ---------- ALARM SOUND ----------
// Browsers only allow audio after the user has tapped the page at least once, so the first
// tap anywhere "unlocks" a WebAudio context that is kept for the alarm.

let timerAudioCtx = null;
let timerAlarmNodes = [];
let timerAlarmMaster = null;
window.lastAlarmedEndsAt = null;

function timerSoundEnabled() {
  try { return localStorage.getItem('timerSoundOn') !== 'false'; } catch (e) { return true; }
}

function setTimerSound(on) {
  try { localStorage.setItem('timerSoundOn', on ? 'true' : 'false'); } catch (e) { /* storage unavailable */ }
  if (!on) stopTimerAlarm();
}

function unlockTimerAudio() {
  try {
    if (!timerAudioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      timerAudioCtx = new AC();
    }
    const finish = () => {
      if (timerAudioCtx.state !== 'running') return;
      // iOS needs a (silent) sound started inside the tap itself
      const src = timerAudioCtx.createBufferSource();
      src.buffer = timerAudioCtx.createBuffer(1, 1, 22050);
      src.connect(timerAudioCtx.destination);
      src.start(0);
      ['touchstart', 'click', 'keydown'].forEach(evt => document.removeEventListener(evt, unlockTimerAudio));
    };
    if (timerAudioCtx.state === 'suspended') timerAudioCtx.resume().then(finish).catch(() => {});
    else finish();
  } catch (e) {
    console.warn("Could not unlock timer audio:", e);
  }
}
['touchstart', 'click', 'keydown'].forEach(evt => document.addEventListener(evt, unlockTimerAudio, { passive: true }));

/** Four bursts of three beeps (about 5 seconds). */
function playTimerAlarm(bursts = 4) {
  if (!timerSoundEnabled() || !timerAudioCtx) return;   // never unlocked by a tap: visual + vibration only
  if (timerAudioCtx.state === 'suspended') timerAudioCtx.resume();
  stopTimerAlarm();

  const ctx = timerAudioCtx;
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  timerAlarmMaster = master;

  let t = ctx.currentTime + 0.05;
  for (let b = 0; b < bursts; b++) {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + 0.01);
      gain.gain.setValueAtTime(1, t + 0.15);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.2);
      timerAlarmNodes.push(osc);
      t += 0.3;
    }
    t += 0.5;   // pause between bursts
  }
}

function stopTimerAlarm() {
  timerAlarmNodes.forEach(o => { try { o.stop(); } catch (e) { /* already ended */ } });
  timerAlarmNodes = [];
  try { timerAlarmMaster?.disconnect(); } catch (e) { /* ignore */ }
  timerAlarmMaster = null;
}

/** Bell button on the bar: turn this device's alarm sound on/off (a short beep confirms "on"). */
function toggleTimerSound() {
  const turnOn = !timerSoundEnabled();
  setTimerSound(turnOn);
  if (turnOn) {
    unlockTimerAudio();
    setTimeout(() => playTimerAlarm(1), 150);
  }
  refreshEventTimer();
}

/** Buzz + beep once per timer per device, and only if we saw it end (or rejoined within 15 s). */
function maybeSoundAlarm(ev, state) {
  if (!state.finished || !ev) return;
  if (window.lastAlarmedEndsAt === ev.TimerEndsAt) return;
  window.lastAlarmedEndsAt = ev.TimerEndsAt;

  const secondsLate = (serverNow() - Number(ev.TimerEndsAt)) / 1000;
  if (secondsLate > 15) return;   // opened the app long after it ended: stay quiet

  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
  playTimerAlarm();
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

/** The countdown length for this event: events.MatchTime (minutes), default 10. */
function matchTimeMs(ev) {
  return (Number(ev?.MatchTime) || 10) * 60000;
}

/** Turns the event's timer fields into { status, remaining, finished, ready }. */
function getTimerState(ev) {
  const status = ev?.TimerStatus || 'off';
  if (status === 'off') return { status: 'off', remaining: 0, finished: false, ready: false };

  if (status === 'paused') {
    const remaining = Math.max(0, Number(ev.TimerRemainingMs) || 0);
    const ready = remaining >= (Number(ev.TimerDurationMs) || 0);
    return { status: 'paused', remaining, finished: false, ready };
  }

  const remaining = Math.max(0, (Number(ev.TimerEndsAt) || 0) - serverNow());
  return { status: 'running', remaining, finished: remaining <= 0, ready: false };
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

// ---------- DISPLAY (bottom bar) ----------

let timerInterval = null;
let timerWasRunningLastTick = false;
window.timerDismissedKey = null; // lets a viewer hide the bar on their own device

/** Identifies the current timer; if anything about it changes, a viewer's "hide" no longer applies. */
function timerKey(ev) {
  return [ev?.TimerStatus, ev?.TimerDurationMs, ev?.TimerEndsAt, ev?.TimerRemainingMs].join('|');
}

/** Call whenever the timer fields might have changed (event load, live update, local action). */
function refreshEventTimer() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);

  clearInterval(timerInterval);
  timerInterval = null;

  if (state.finished) maybeSoundAlarm(ev, state);
  else stopTimerAlarm();   // timer was reset, stopped, closed or restarted

  if (state.status === 'running' && !state.finished) {
    timerWasRunningLastTick = true;
    timerInterval = setInterval(tickEventTimer, 250);
  } else {
    timerWasRunningLastTick = false;
  }

  renderTimerBar(ev, state);
}

function tickEventTimer() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);

  if (state.finished && timerWasRunningLastTick) {
    // Just crossed zero while we were watching: sound the alarm, then stop ticking
    timerWasRunningLastTick = false;
    clearInterval(timerInterval);
    timerInterval = null;
    maybeSoundAlarm(ev, state);
    renderTimerBar(ev, state);
    return;
  }

  updateTimerDigits(state);
}

function renderTimerBar(ev, state) {
  const bar = document.getElementById('timer-bar');
  if (!bar) return;

  const hiddenHere = window.timerDismissedKey !== null && window.timerDismissedKey === timerKey(ev);
  const visible = state.status !== 'off' && !hiddenHere;

  bar.hidden = !visible;
  document.body.classList.toggle('timer-visible', visible);
  if (!visible) { bar.innerHTML = ''; return; }

  const warning = state.status === 'running' && !state.finished && state.remaining <= TIMER_WARNING_MS;
  bar.classList.toggle('timer-warning', warning);
  bar.classList.toggle('timer-finished', state.finished);
  bar.classList.toggle('timer-idle', state.status === 'paused');

  const statusText = state.finished ? "Time's up"
    : state.status === 'running' ? 'Running'
    : state.ready ? 'Ready' : 'Stopped';

  let actions = '';
  if (canControlTimer()) {
    if (state.status === 'running' && !state.finished) {
      actions = `<button class="timer-bar-btn" onclick="timerStop()">Stop</button>
                 <button class="timer-bar-btn" onclick="timerReset()">Reset</button>`;
    } else if (state.status === 'paused') {
      actions = `<button class="timer-bar-btn primary" onclick="timerStart()">Start</button>
                 <button class="timer-bar-btn" onclick="timerReset()">Reset</button>`;
    } else {   // finished
      actions = `<button class="timer-bar-btn primary" onclick="timerReset()">Reset</button>`;
    }
  }

  bar.innerHTML = `
    <button class="timer-bar-icon" onclick="toggleTimerSound()" aria-label="Alarm sound on or off">${timerSoundEnabled() ? '🔔' : '🔕'}</button>
    <div class="timer-bar-main" onclick="stopTimerAlarm()">
      <div class="timer-bar-time" id="timer-bar-time">${state.finished ? 'TIME!' : formatTimerMs(state.remaining)}</div>
      <div class="timer-bar-status">${statusText}</div>
    </div>
    <div class="timer-bar-actions">${actions}</div>
    <button class="timer-bar-icon" onclick="timerClose()" aria-label="Close timer">✕</button>
  `;
}

/** Cheap per-tick update: only the numbers and the red warning, never the buttons. */
function updateTimerDigits(state) {
  const time = document.getElementById('timer-bar-time');
  if (time) time.innerText = state.finished ? 'TIME!' : formatTimerMs(state.remaining);

  document.getElementById('timer-bar')?.classList.toggle(
    'timer-warning',
    state.status === 'running' && !state.finished && state.remaining <= TIMER_WARNING_MS
  );
}

// ---------- CONTROLS (main PickleMe app only) ----------

/** Updates the local cache straight away, then writes to Firestore for everyone else. */
function writeTimer(fields) {
  if (!canControlTimer()) return;
  const ev = getTimerEvent();
  if (!ev) return;

  Object.assign(ev, fields);
  window.timerDismissedKey = null;
  refreshEventTimer();

  window.updateEventInFirestore(ev.EventID, fields)
    .then(() => console.log("Timer saved:", fields.TimerStatus))
    .catch(err => console.error("Failed to save timer:", err));
}

/** The Timer icon in the Draw FAB menu: creates a ready-to-start countdown from events.MatchTime. */
function toggleEventTimer() {
  if (!canControlTimer()) {
    alert("The timer is started from the main PickleMe app.");
    return;
  }
  const ev = getTimerEvent();
  if (!ev) return;

  if (getTimerState(ev).status !== 'off') {
    // Already showing: just make sure it's visible on this device again
    window.timerDismissedKey = null;
    refreshEventTimer();
    return;
  }

  const duration = matchTimeMs(ev);
  writeTimer({
    TimerStatus: 'paused',
    TimerDurationMs: duration,
    TimerEndsAt: null,
    TimerRemainingMs: duration
  });
}

function timerStart() {
  const state = getTimerState(getTimerEvent());
  if (state.status !== 'paused') return;
  const remaining = state.remaining > 0 ? state.remaining : matchTimeMs(getTimerEvent());
  writeTimer({
    TimerStatus: 'running',
    TimerEndsAt: serverNow() + remaining,
    TimerRemainingMs: remaining
  });
}

/** Stop = pause: the time left is kept, and Start carries on from there. */
function timerStop() {
  const state = getTimerState(getTimerEvent());
  if (state.status !== 'running') return;
  writeTimer({ TimerStatus: 'paused', TimerEndsAt: null, TimerRemainingMs: state.remaining });
}

/** Reset = back to the full MatchTime, ready to start (re-reads MatchTime in case it was edited). */
function timerReset() {
  const ev = getTimerEvent();
  const state = getTimerState(ev);
  if (state.status === 'running' && !state.finished && !confirm("Reset the timer while it is running?")) return;

  const duration = matchTimeMs(ev);
  writeTimer({
    TimerStatus: 'paused',
    TimerDurationMs: duration,
    TimerEndsAt: null,
    TimerRemainingMs: duration
  });
}

/** ✕ on the bar. PickleMe: removes the timer for everyone. Other apps: hides it on this device only. */
function timerClose() {
  stopTimerAlarm();
  const ev = getTimerEvent();
  const state = getTimerState(ev);

  if (canControlTimer()) {
    if (state.status === 'running' && !state.finished && !confirm("Remove the running timer for everyone?")) return;
    writeTimer({ TimerStatus: 'off', TimerEndsAt: null, TimerRemainingMs: null });
  } else {
    window.timerDismissedKey = timerKey(ev);
    refreshEventTimer();
  }
}

// Coming back to the app after it was backgrounded: catch up immediately
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshEventTimer();
});