// ── State ──────────────────────────────────────────
const state = {
  tracks: [],        // { name, url, size }
  current: -1,
  playing: false,
};

const audio = new Audio();

// ── DOM refs ───────────────────────────────────────
const $ = id => document.getElementById(id);
const btnPlay     = $('btn-play');
const btnPrev     = $('btn-prev');
const btnNext     = $('btn-next');
const btnOpen     = $('open-btn');
const fileInput   = $('file-input');
const progressWrap= $('progress-wrap');
const progressFill= $('progress-fill');
const progressThumb=$('progress-thumb');
const timeCurrent = $('time-current');
const timeDuration= $('time-duration');
const songTitle   = $('song-title');
const songArtist  = $('song-artist');
const trackCount  = $('track-count');
const tracklist   = $('tracklist');
const trackItems  = $('tracklist-items');
const artwork     = $('artwork');
const artworkGlow = $('artwork-glow');
const iconPlay    = btnPlay.querySelector('.icon-play');
const iconPause   = btnPlay.querySelector('.icon-pause');

// ── File Loading ────────────────────────────────────
btnOpen.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(f =>
    f.type.startsWith('audio/') || f.name.toLowerCase().endsWith('.mp3')
  );
  if (!files.length) return;

  // Revoke old object URLs to free memory
  state.tracks.forEach(t => URL.revokeObjectURL(t.url));

  state.tracks = files.map(f => ({
    name: cleanName(f.name),
    url: URL.createObjectURL(f),
    size: formatSize(f.size),
  }));

  state.current = -1;
  renderTracklist();
  updateTrackCount();
  loadTrack(0);
  fileInput.value = '';
});

// ── Playback ────────────────────────────────────────
function loadTrack(index) {
  if (index < 0 || index >= state.tracks.length) return;
  state.current = index;
  const track = state.tracks[index];
  audio.src = track.url;
  audio.load();
  songTitle.textContent = track.name;
  songArtist.textContent = `Track ${index + 1} of ${state.tracks.length}`;
  updateProgress(0, 0);
  highlightTrack(index);

  if (state.playing) {
    audio.play().catch(() => {});
  }
}

function play() {
  if (state.current === -1 && state.tracks.length) loadTrack(0);
  audio.play().then(() => {
    state.playing = true;
    setPlayingUI(true);
  }).catch(() => {});
}

function pause() {
  audio.pause();
  state.playing = false;
  setPlayingUI(false);
}

function togglePlay() {
  state.playing ? pause() : play();
}

function next() {
  if (!state.tracks.length) return;
  const idx = (state.current + 1) % state.tracks.length;
  state.playing = true;
  loadTrack(idx);
}

function prev() {
  if (!state.tracks.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const idx = (state.current - 1 + state.tracks.length) % state.tracks.length;
  state.playing = true;
  loadTrack(idx);
}

function setPlayingUI(playing) {
  iconPlay.style.display  = playing ? 'none'  : '';
  iconPause.style.display = playing ? ''      : 'none';
  artwork.classList.toggle('playing', playing);
  artworkGlow.classList.toggle('active', playing);

  // Update playing indicator bars on active track
  const activeItem = trackItems.querySelector('.track-item.active .playing-indicator');
  if (activeItem) activeItem.classList.toggle('paused', !playing);
}

// ── Audio Events ────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  updateProgress(audio.currentTime, audio.duration || 0);
});

audio.addEventListener('ended', () => next());

audio.addEventListener('loadedmetadata', () => {
  timeDuration.textContent = formatTime(audio.duration);
});

// ── Progress Bar ────────────────────────────────────
function updateProgress(current, duration) {
  const pct = duration ? (current / duration) * 100 : 0;
  progressFill.style.width  = pct + '%';
  progressThumb.style.left  = pct + '%';
  timeCurrent.textContent   = formatTime(current);
  if (duration) timeDuration.textContent = formatTime(duration);
}

progressWrap.addEventListener('click', e => {
  if (!audio.duration) return;
  const rect = progressWrap.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
});

// Touch scrubbing
let scrubbing = false;
progressWrap.addEventListener('touchstart', e => { scrubbing = true; scrub(e.touches[0]); }, { passive: true });
progressWrap.addEventListener('touchmove',  e => { if (scrubbing) scrub(e.touches[0]); }, { passive: true });
progressWrap.addEventListener('touchend',   () => { scrubbing = false; });

function scrub(touch) {
  if (!audio.duration) return;
  const rect = progressWrap.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
}

// ── Controls ────────────────────────────────────────
btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') next();
  if (e.code === 'ArrowLeft')  prev();
});

// ── Tracklist ───────────────────────────────────────
function renderTracklist() {
  if (!state.tracks.length) { tracklist.style.display = 'none'; return; }
  tracklist.style.display = '';
  trackItems.innerHTML = '';

  state.tracks.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.dataset.index = i;
    item.innerHTML = `
      <div class="track-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="track-details">
        <div class="track-name">${escapeHtml(track.name)}</div>
        <div class="track-size">${track.size}</div>
      </div>
      <div class="playing-indicator">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
    `;
    item.addEventListener('click', () => {
      state.playing = true;
      loadTrack(i);
      play();
    });
    trackItems.appendChild(item);
  });
}

function highlightTrack(index) {
  trackItems.querySelectorAll('.track-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  // Scroll active track into view
  const activeEl = trackItems.querySelector('.track-item.active');
  if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateTrackCount() {
  const n = state.tracks.length;
  trackCount.textContent = n ? `${n} TRACK${n !== 1 ? 'S' : ''}` : 'NO TRACKS';
}

// ── Background Visualizer ───────────────────────────
const canvas = $('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

for (let i = 0; i < 40; i++) {
  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.5 + 0.5,
    dx: (Math.random() - 0.5) * 0.3,
    dy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.1,
  });
}

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232, 255, 74, ${p.alpha * (state.playing ? 1 : 0.4)})`;
    ctx.fill();
    p.x += p.dx * (state.playing ? 2 : 1);
    p.y += p.dy * (state.playing ? 2 : 1);
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;
  });
  requestAnimationFrame(drawParticles);
}
drawParticles();

// ── Utilities ───────────────────────────────────────
function cleanName(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')      // remove extension
    .replace(/[-_]/g, ' ')         // dashes/underscores → spaces
    .replace(/\s+/g, ' ')          // collapse spaces
    .trim();
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Media Session (lock screen controls) ────────────
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play',           play);
  navigator.mediaSession.setActionHandler('pause',          pause);
  navigator.mediaSession.setActionHandler('previoustrack',  prev);
  navigator.mediaSession.setActionHandler('nexttrack',      next);
}
