const YOUTUBE_API_KEY = 'AIzaSyCzqWoDzcAO7eezfXPfguCwghlDh_ifZs8';

const CHANNEL_IDS = {
    'VinylArcheologie':              'UCKydEBEvAU5zkN8o1snt62A',
    'librariessountracksandrelated': 'UCekevJPGTZ44nn_i4SWJDIw',
    'andrenavarroII':                'UCv5OAW45h67CJEY6kJLyisg',
    'oleg_samples':                  'UC47qc6t2RelhfvI-OjgIY2A'
};

let allVideos   = [];
let currentIndex = 0;
let isLoading   = false;
let players     = {};
let ytApiReady  = false;
let isNavigating = false;

const videoContainer = document.getElementById('video-container');
const videoWrapper   = document.getElementById('video-wrapper');
const loadingEl      = document.getElementById('loading');
const artistNameEl   = document.getElementById('artist-name');
const albumTitleEl   = document.getElementById('album-title');
const albumYearEl    = document.getElementById('album-year');
const btnPlaylist    = document.getElementById('btn-playlist');
const btnFiltri      = document.getElementById('btn-filtri');

let startY      = 0;
let currentY    = 0;
let isSwiping   = false;
let swipeStartTime = 0;
let lastWheelTime  = 0;

// ── YouTube IFrame API ──
window.onYouTubeIframeAPIReady = () => { ytApiReady = true; };
const ytScript = document.createElement('script');
ytScript.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(ytScript);

// ── Utilities ──
function parseVideoTitle(rawTitle) {
    const yearMatch = rawTitle.match(/[\(\[]((?:19|20)\d{2})[\)\]]/);
    const year  = yearMatch ? yearMatch[1] : '';
    const clean = rawTitle.replace(/[\(\[]((?:19|20)\d{2})[\)\]]/, '').trim();
    const dashIdx = clean.indexOf(' - ');
    if (dashIdx > 0) {
        return { artist: clean.substring(0, dashIdx).trim(), title: clean.substring(dashIdx + 3).trim(), year };
    }
    return { artist: '', title: clean, year };
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Fetch — per ogni canale prendo sia i recenti che i più visti ──
async function fetchChannelVideos(channelId, order) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}` +
        `&channelId=${channelId}&part=snippet,id&order=${order}&maxResults=50&type=video`;
    try {
        const data = await fetch(url).then(r => r.json());
        return (data.items || []).filter(i => i.id.videoId).map(i => ({
            id:        i.id.videoId,
            title:     i.snippet.title,
            channel:   i.snippet.channelTitle,
            thumbnail: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url,
            published: i.snippet.publishedAt
        }));
    } catch (e) {
        console.error('Fetch error:', e);
        return [];
    }
}

async function fetchAllVideos() {
    const seen = new Set();
    const result = [];
    const orders = ['date', 'viewCount'];

    for (const channelId of Object.values(CHANNEL_IDS)) {
        for (const order of orders) {
            const videos = await fetchChannelVideos(channelId, order);
            for (const v of videos) {
                if (!seen.has(v.id)) { seen.add(v.id); result.push(v); }
            }
        }
    }
    return shuffleArray(result);
}

// ── Slide DOM ──
function createVideoSlide(video, index) {
    const slide = document.createElement('div');
    slide.className = 'video-slide';
    slide.dataset.index = index;
    slide.innerHTML = `
        <div class="thumbnail-bg" style="background-image:url(${video.thumbnail})"></div>
        <div class="iframe-container" id="yt-player-${index}"></div>
        <div class="swipe-overlay"></div>
        <div class="pp-indicator" id="pp-indicator-${index}"></div>
    `;
    const overlay = slide.querySelector('.swipe-overlay');
    overlay.addEventListener('touchstart', handleTouchStart, { passive: true });
    overlay.addEventListener('touchmove',  handleTouchMove,  { passive: true });
    overlay.addEventListener('touchend',   handleTouchEnd,   { passive: true });
    return slide;
}

function slideAt(index) {
    return videoWrapper.querySelectorAll('.video-slide')[index];
}

// ── Player ──
function createPlayer(index) {
    if (players[index] || !ytApiReady) return;
    players[index] = new YT.Player(`yt-player-${index}`, {
        videoId: allVideos[index].id,
        playerVars: {
            autoplay: 0, controls: 0, disablekb: 1,
            fs: 0, modestbranding: 1, rel: 0,
            showinfo: 0, iv_load_policy: 3, playsinline: 1
        },
        events: {
            onReady(e) { if (index === currentIndex) e.target.playVideo(); }
        }
    });
}

function updateUI(video) {
    const p = parseVideoTitle(video.title);
    artistNameEl.textContent = p.artist || video.channel;
    albumTitleEl.textContent = p.title;
    albumYearEl.textContent  = p.year || new Date(video.published).getFullYear();
    btnPlaylist.onclick = () => window.open(`https://youtube.com/watch?v=${video.id}`, '_blank');
}

function togglePlayPause(index) {
    const player = players[index];
    if (!player) return;
    const indicator = document.getElementById(`pp-indicator-${index}`);
    try {
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo(); flash(indicator, '⏸');
        } else {
            player.playVideo();  flash(indicator, '▶');
        }
    } catch (e) {}
}

function flash(el, symbol) {
    if (!el) return;
    el.textContent = symbol;
    el.classList.add('visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), 700);
}

// ── TikTok-style navigation ──
const ANIM_MS = 320;

function navigateTo(nextIndex, direction) {
    if (isNavigating) return;
    if (nextIndex < 0 || nextIndex >= allVideos.length) return;

    isNavigating = true;

    const curSlide  = slideAt(currentIndex);
    const nextSlide = slideAt(nextIndex);

    // Ensure next slide is visible and positioned
    nextSlide.style.transition = 'none';
    nextSlide.style.transform  = direction === 'up' ? 'translateY(100%)' : 'translateY(-100%)';
    nextSlide.style.display    = 'flex';

    // Force reflow so the initial position is applied before animating
    nextSlide.getBoundingClientRect();

    const ease = `transform ${ANIM_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    curSlide.style.transition  = ease;
    nextSlide.style.transition = ease;

    curSlide.style.transform  = direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)';
    nextSlide.style.transform = 'translateY(0)';

    setTimeout(() => {
        // Hide and reset old slide
        curSlide.style.display    = 'none';
        curSlide.style.transform  = 'translateY(0)';
        curSlide.style.transition = 'none';

        // Pause old player
        if (players[currentIndex]) { try { players[currentIndex].pauseVideo(); } catch (e) {} }

        currentIndex = nextIndex;

        // Activate new player
        nextSlide.querySelector('.thumbnail-bg').classList.add('hidden');
        if (!players[currentIndex]) createPlayer(currentIndex);
        else { try { players[currentIndex].playVideo(); } catch (e) {} }

        updateUI(allVideos[currentIndex]);
        isNavigating = false;
    }, ANIM_MS);
}

function goToNext() { navigateTo(currentIndex + 1, 'up'); }
function goToPrev() { navigateTo(currentIndex - 1, 'down'); }

// ── Touch — vero effetto TikTok: si vede il prossimo che sale ──
function handleTouchStart(e) {
    if (isNavigating) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    isSwiping = true;
    swipeStartTime = Date.now();

    // Pre-position adjacent slides
    const nextSlide = slideAt(currentIndex + 1);
    const prevSlide = slideAt(currentIndex - 1);
    if (nextSlide) { nextSlide.style.transition = 'none'; nextSlide.style.transform = 'translateY(100%)'; nextSlide.style.display = 'flex'; }
    if (prevSlide) { prevSlide.style.transition = 'none'; prevSlide.style.transform = 'translateY(-100%)'; prevSlide.style.display = 'flex'; }
}

function handleTouchMove(e) {
    if (!isSwiping || isNavigating) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY; // positive = drag down, negative = drag up

    const curSlide = slideAt(currentIndex);
    curSlide.style.transition = 'none';
    curSlide.style.transform  = `translateY(${diff}px)`;

    if (diff < 0 && currentIndex < allVideos.length - 1) {
        const nextSlide = slideAt(currentIndex + 1);
        if (nextSlide) { nextSlide.style.transition = 'none'; nextSlide.style.transform = `translateY(calc(100% + ${diff}px))`; }
    } else if (diff > 0 && currentIndex > 0) {
        const prevSlide = slideAt(currentIndex - 1);
        if (prevSlide) { prevSlide.style.transition = 'none'; prevSlide.style.transform = `translateY(calc(-100% + ${diff}px))`; }
    }
}

function handleTouchEnd() {
    if (!isSwiping) return;
    isSwiping = false;

    const diff      = currentY - startY;
    const swipeTime = Date.now() - swipeStartTime;
    const velocity  = Math.abs(diff) / swipeTime;
    const isSwipe   = Math.abs(diff) > 60 || velocity > 0.4;
    const isTap     = Math.abs(diff) < 10 && swipeTime < 250;

    // Reset adjacent slides that aren't going to be navigated to
    const cleanup = (index) => {
        const s = slideAt(index);
        if (s) { s.style.display = 'none'; s.style.transform = 'translateY(0)'; s.style.transition = 'none'; }
    };

    if (isSwipe && diff < 0 && currentIndex < allVideos.length - 1) {
        // Complete the up-swipe (go next) — slides already moving, just finish
        const ease = `transform ${ANIM_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        const curSlide  = slideAt(currentIndex);
        const nextSlide = slideAt(currentIndex + 1);
        curSlide.style.transition  = ease;
        nextSlide.style.transition = ease;
        curSlide.style.transform   = 'translateY(-100%)';
        nextSlide.style.transform  = 'translateY(0)';
        cleanup(currentIndex - 1);

        setTimeout(() => {
            curSlide.style.display    = 'none';
            curSlide.style.transform  = 'translateY(0)';
            curSlide.style.transition = 'none';
            if (players[currentIndex]) { try { players[currentIndex].pauseVideo(); } catch (e) {} }
            currentIndex = currentIndex + 1;
            nextSlide.querySelector('.thumbnail-bg').classList.add('hidden');
            if (!players[currentIndex]) createPlayer(currentIndex);
            else { try { players[currentIndex].playVideo(); } catch (e) {} }
            updateUI(allVideos[currentIndex]);
            isNavigating = false;
        }, ANIM_MS);
    } else if (isSwipe && diff > 0 && currentIndex > 0) {
        // Complete the down-swipe (go prev)
        const ease = `transform ${ANIM_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        const curSlide  = slideAt(currentIndex);
        const prevSlide = slideAt(currentIndex - 1);
        curSlide.style.transition  = ease;
        prevSlide.style.transition = ease;
        curSlide.style.transform   = 'translateY(100%)';
        prevSlide.style.transform  = 'translateY(0)';
        cleanup(currentIndex + 1);

        setTimeout(() => {
            curSlide.style.display    = 'none';
            curSlide.style.transform  = 'translateY(0)';
            curSlide.style.transition = 'none';
            if (players[currentIndex]) { try { players[currentIndex].pauseVideo(); } catch (e) {} }
            currentIndex = currentIndex - 1;
            prevSlide.querySelector('.thumbnail-bg').classList.add('hidden');
            if (!players[currentIndex]) createPlayer(currentIndex);
            else { try { players[currentIndex].playVideo(); } catch (e) {} }
            updateUI(allVideos[currentIndex]);
            isNavigating = false;
        }, ANIM_MS);
    } else {
        // Snap back
        const ease = `transform ${ANIM_MS / 2}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        const curSlide = slideAt(currentIndex);
        curSlide.style.transition = ease;
        curSlide.style.transform  = 'translateY(0)';
        cleanup(currentIndex + 1);
        cleanup(currentIndex - 1);

        if (isTap) togglePlayPause(currentIndex);
    }
}

// ── Wheel with 500ms cooldown ──
function handleWheel(e) {
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheelTime < 500) return;
    lastWheelTime = now;
    if (e.deltaY > 0) goToNext(); else if (e.deltaY < 0) goToPrev();
}

// ── Initial play ──
function startAt(index) {
    const slide = slideAt(index);
    slide.style.display   = 'flex';
    slide.style.transform = 'translateY(0)';
    slide.querySelector('.thumbnail-bg').classList.add('hidden');
    currentIndex = index;
    createPlayer(index);
    updateUI(allVideos[index]);
}

// ── Shuffle button ──
function shuffleAndRestart() {
    Object.values(players).forEach(p => { try { p.destroy(); } catch (e) {} });
    players = {};
    allVideos = shuffleArray(allVideos);
    videoWrapper.innerHTML = '';
    allVideos.forEach((v, i) => videoWrapper.appendChild(createVideoSlide(v, i)));
    startAt(Math.floor(Math.random() * allVideos.length));
}

// ── Init ──
async function loadVideos() {
    if (isLoading) return;
    isLoading = true;

    allVideos = await fetchAllVideos();
    allVideos.forEach((v, i) => videoWrapper.appendChild(createVideoSlide(v, i)));

    loadingEl.classList.add('hidden');
    if (allVideos.length > 0) startAt(Math.floor(Math.random() * allVideos.length));
    isLoading = false;
}

btnFiltri.addEventListener('click', shuffleAndRestart);
videoContainer.addEventListener('wheel', handleWheel, { passive: false });
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'j')    goToNext();
    else if (e.key === 'ArrowUp' || e.key === 'k') goToPrev();
    else if (e.key === ' ') { e.preventDefault(); togglePlayPause(currentIndex); }
});

loadVideos();
