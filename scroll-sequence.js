/**
 * scroll-sequence.js
 * Scroll-linked canvas image sequence for Toyo Aviation hero.
 *
 * Architecture (mirrors the spec but in vanilla JS):
 *   - Lenis CDN  → smooth scroll
 *   - Canvas     → frame-accurate image rendering (object-fit: cover)
 *   - Preloader  → load all frames immediately, show frame 0 right away
 *   - ScrollWire → RAF loop maps scrollY → frame index → canvas draw
 */

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const FRAME_COUNT  = 120;
const FRAME_PREFIX = 'sequence/ezgif-frame-';  // relative to jet-hero/
const FRAME_EXT    = '.jpg';
const SCROLL_HEIGHT_VH = 300;   // outer container = 300vh (scroll distance)

/* ─────────────────────────────────────────────
   UTILS: drawImageCover  (mirrors canvas-render.ts)
───────────────────────────────────────────── */
function drawImageCover(ctx, img, canvasW, canvasH) {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const imageAspect  = img.naturalWidth / img.naturalHeight;
  const canvasAspect = canvasW / canvasH;

  let rw, rh, xStart, yStart;

  if (imageAspect < canvasAspect) {
    rw     = canvasW;
    rh     = canvasW / imageAspect;
    xStart = 0;
    yStart = (canvasH - rh) / 2;
  } else {
    rh     = canvasH;
    rw     = canvasH * imageAspect;
    yStart = 0;
    xStart = (canvasW - rw) / 2;
  }

  ctx.drawImage(img, xStart, yStart, rw, rh);
}

/* ─────────────────────────────────────────────
   UTILS: zero-pad frame number  (e.g., 3 → "003")
───────────────────────────────────────────── */
function padFrame(n) {
  return String(n + 1).padStart(3, '0');
}

/* ─────────────────────────────────────────────
   IMAGE PRELOADER  (mirrors useImagePreloader.ts)
   Returns all Image objects; each loads independently.
───────────────────────────────────────────── */
function preloadImages(onFirstFrameReady) {
  const images = new Array(FRAME_COUNT).fill(null);
  let firstReady = false;

  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image();
    img.src   = `${FRAME_PREFIX}${padFrame(i)}${FRAME_EXT}`;

    img.onload = () => {
      images[i] = img;
      if (!firstReady && i === 0) {
        firstReady = true;
        onFirstFrameReady(images);
      }
    };

    // Eagerly store reference so the array slot exists immediately
    images[i] = img;
  }

  return images;
}

/* ─────────────────────────────────────────────
   CANVAS RESIZE → keeps pixel-perfect resolution
───────────────────────────────────────────── */
function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

/* ─────────────────────────────────────────────
   MAIN INIT
───────────────────────────────────────────── */
function initScrollSequence() {

  /* 1. Build the DOM structure ─────────────────
   *
   *  BEFORE (existing):
   *    .hero-bg → <img>
   *    .hero-section → text / button
   *    .stats-bar
   *
   *  AFTER:
   *    #seq-outer  (h:300vh, relative)   ← scroll container
   *      #seq-sticky (h:100vh, sticky)   ← sticky viewport
   *        #seq-canvas  (inset-0, z:0)   ← animating frames
   *        .existing-hero-ui  (z:10)     ← text / stats on top
   */

  /* --- grab existing elements --- */
  const existingHeroBg  = document.querySelector('.hero-bg');
  const heroSection     = document.querySelector('.hero-section');
  const statsBar        = document.querySelector('.stats-bar');
  const tickerWrapper   = document.querySelector('.ticker-wrapper');

  if (!heroSection) {
    console.warn('[scroll-sequence] .hero-section not found');
    return;
  }

  /* --- hide the old static background --- */
  if (existingHeroBg) existingHeroBg.style.display = 'none';

  /* --- create outer scroll container (300vh) --- */
  const outer = document.createElement('div');
  outer.id = 'seq-outer';
  Object.assign(outer.style, {
    position:    'relative',
    height:      SCROLL_HEIGHT_VH + 'vh',
    width:       '100%',
    marginTop:   '-' + (heroSection.offsetTop || 0) + 'px', // absorb nav height
  });

  /* --- create sticky inner container (100vh) --- */
  const sticky = document.createElement('div');
  sticky.id = 'seq-sticky';
  Object.assign(sticky.style, {
    position:        'sticky',
    top:             '0',
    height:          '100vh',
    width:           '100%',
    overflow:        'hidden',
    willChange:      'transform',   // GPU hint
  });

  /* --- create canvas --- */
  const canvas = document.createElement('canvas');
  canvas.id = 'seq-canvas';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset:    '0',
    zIndex:   '0',
    width:    '100%',
    height:   '100%',
  });

  /* --- create UI overlay wrapper --- */
  const uiOverlay = document.createElement('div');
  uiOverlay.id = 'seq-ui';
  Object.assign(uiOverlay.style, {
    position:  'relative',
    zIndex:    '10',
    height:    '100%',
    display:   'flex',
    flexDirection: 'column',
  });

  /* --- create background video --- */
  const video = document.createElement('video');
  video.id = 'seq-video';
  video.src = 'hero-video.mp4';
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  Object.assign(video.style, {
    position:  'absolute',
    inset:     '0',
    zIndex:    '1', // Above canvas, below UI
    width:     '100%',
    height:    '100%',
    objectFit: 'cover',
    willChange: 'opacity'
  });

  /* --- move existing hero + stats inside the overlay --- */
  heroSection.parentNode.insertBefore(outer, heroSection);
  uiOverlay.appendChild(heroSection);
  if (statsBar) uiOverlay.appendChild(statsBar);

  sticky.appendChild(canvas);
  sticky.appendChild(video);
  sticky.appendChild(uiOverlay);
  outer.appendChild(sticky);

  /* move ticker after the outer container */
  if (tickerWrapper && outer.nextSibling) {
    outer.parentNode.insertBefore(tickerWrapper, outer.nextSibling);
  }

  /* 2. Canvas setup ──────────────────────────── */
  let ctx = resizeCanvas(canvas);

  window.addEventListener('resize', () => {
    ctx = resizeCanvas(canvas);
    renderFrame(currentFrame);
  });

  /* 3. Preload frames ────────────────────────── */
  let currentFrame = 0;
  const images = preloadImages((imgs) => {
    // First frame ready → draw immediately (prevents white flash)
    renderFrame(0);
  });

  function renderFrame(index) {
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawImageCover(ctx, img, window.innerWidth, window.innerHeight);
  }

  /* 4. Lenis smooth scroll ───────────────────── */
  let lenis;
  // Lenis is loaded via CDN — wait for it
  function initLenis() {
    if (typeof Lenis === 'undefined') {
      requestAnimationFrame(initLenis);
      return;
    }

    lenis = new Lenis({
      lerp:      0.08,   // smoothness (0 = instant, 1 = never arrives)
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
  initLenis();

  /* 5. Scroll wiring ─────────────────────────── */
  function onScroll() {
    const outerRect   = outer.getBoundingClientRect();
    const scrollTop   = -outerRect.top;                       // px scrolled into sequence
    const scrollable  = outer.offsetHeight - window.innerHeight; // total scrollable px
    
    // Video fade out logic
    const FADE_END = 200; // pixels over which to fade out the video
    if (scrollTop <= 0) {
      video.style.opacity = 1;
      if (video.paused) video.play().catch(() => {});
    } else if (scrollTop <= FADE_END) {
      video.style.opacity = 1 - (scrollTop / FADE_END);
      if (video.paused) video.play().catch(() => {});
    } else {
      video.style.opacity = 0;
      if (!video.paused) video.pause();
    }

    const progress    = Math.max(0, Math.min(1, scrollTop / scrollable));
    const frame = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));

    if (frame !== currentFrame) {
      currentFrame = frame;
      renderFrame(frame);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* Also wire into Lenis scroll event for extra smoothness */
  function waitForLenis() {
    if (!lenis) { requestAnimationFrame(waitForLenis); return; }
    lenis.on('scroll', onScroll);
  }
  waitForLenis();

  /* 6. Initial draw ──────────────────────────── */
  renderFrame(0);

  /* 7. Nav show / hide tied to ticker position ── */
  initNavBehavior();
}

/* ─────────────────────────────────────────────
   NAV BEHAVIOUR
   - Hidden (off-screen) while the hero sequence plays
   - Slides in once the ticker (.ticker-wrapper) scrolls
     past the top of the viewport
   - Slides back out when scrolling up past the ticker
───────────────────────────────────────────── */
function initNavBehavior() {
  const nav    = document.querySelector('.top-nav');
  const ticker = document.querySelector('.ticker-wrapper');
  if (!nav || !ticker) return;

  function updateNav() {
    const rect = ticker.getBoundingClientRect();
    /*
     * Show nav when the BOTTOM of the ticker goes above the viewport top
     * (i.e., ticker has fully scrolled off-screen upward).
     * Hide nav when the bottom of the ticker is still visible or below top.
     */
    if (rect.bottom <= 0) {
      nav.classList.add('nav-visible');
    } else {
      nav.classList.remove('nav-visible');
    }
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  // Fire once on load to handle any edge states
  updateNav();
}

/* ─────────────────────────────────────────────
   BOOT — wait for DOM
───────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollSequence);
} else {
  initScrollSequence();
}
