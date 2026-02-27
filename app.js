const YOUTUBE_API_KEY = 'AIzaSyCzqWoDzcAO7eezfXPfguCwghlDh_ifZs8';

const CHANNEL_IDS = {
    'VinylArcheologie':              'UCKydEBEvAU5zkN8o1snt62A',
    'librariessountracksandrelated': 'UCekevJPGTZ44nn_i4SWJDIw',
    'andrenavarroII':                'UCv5OAW45h67CJEY6kJLyisg',
    'oleg_samples':                  'UC47qc6t2RelhfvI-OjgIY2A'
};

let allVideos = [];
let currentIndex = 0;
let isLoading = false;
let isNavigating = false;

const videoContainer = document.getElementById('video-container');
const videoWrapper = document.getElementById('video-wrapper');
const loadingEl = document.getElementById('loading');
const artistNameEl = document.getElementById('artist-name');
const albumTitleEl = document.getElementById('album-title');
const btnPlaylist = document.getElementById('btn-playlist');

let startY = 0;
let currentY = 0;
let isSwiping = false;
let swipeStartTime = 0;

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

async function fetchChannelVideos(channelId, order) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=${order}&maxResults=50&type=video`;
    try {
        const data = await fetch(url).then(r => r.json());
        return (data.items || []).filter(i => i.id.videoId).map(i => ({
            id: i.id.videoId,
            title: i.snippet.title,
            channel: i.snippet.channelTitle,
            thumbnail: `https://i.ytimg.com/vi/${i.id.videoId}/hqdefault.jpg`,
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
    
    const dateRanges = [
        '',
        '&publishedBefore=2024-01-01T00:00:00Z',
        '&publishedBefore=2023-01-01T00:00:00Z',
        '&publishedBefore=2022-01-01T00:00:00Z',
        '&publishedBefore=2021-01-01T00:00:00Z',
        '&publishedBefore=2020-01-01T00:00:00Z'
    ];
    
    for (const channelId of Object.values(CHANNEL_IDS)) {
        for (const dateRange of dateRanges) {
            for (let page = 0; page < 3; page++) {
                const pageToken = page === 0 ? '' : '&pageToken=' + ('CA' + 'A'.repeat(page + 2) + 'AA').slice(-(page + 3));
                const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50&type=video${dateRange}${pageToken}`;
                try {
                    const data = await fetch(url).then(r => r.json());
                    if (!data.items || data.items.length === 0) break;
                    for (const item of data.items) {
                        if (!item.id.videoId) continue;
                        if (!seen.has(item.id.videoId)) {
                            seen.add(item.id.videoId);
                            result.push({
                                id: item.id.videoId,
                                title: item.snippet.title,
                                channel: item.snippet.channelTitle,
                                thumbnail: `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
                                published: item.snippet.publishedAt
                            });
                        }
                    }
                    if (!data.nextPageToken) break;
                } catch (e) {
                    console.error('Fetch error:', e);
                }
            }
        }
    }
    
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
}

function parseVideoTitle(rawTitle) {
    const yearMatch = rawTitle.match(/[\(\[]((?:19|20)\d{2})[\)\]]/);
    const year = yearMatch ? yearMatch[1] : '';
    const clean = rawTitle.replace(/[\(\[]((?:19|20)\d{2})[\)\]]/, '').trim();
    const dashIdx = clean.indexOf(' - ');
    if (dashIdx > 0) {
        return { artist: clean.substring(0, dashIdx).trim(), title: clean.substring(dashIdx + 3).trim(), year };
    }
    return { artist: '', title: clean, year };
}

function createVideoSlide(video, index) {
    const slide = document.createElement('div');
    slide.className = 'video-slide';
    slide.dataset.index = index;
    
    slide.innerHTML = `
        <div class="thumbnail-bg" style="background-image:url(${video.thumbnail})"></div>
        <iframe id="player-${index}" 
            src="https://www.youtube.com/embed/${video.id}?enablejsapi=1&iv_load_policy=3&playsinline=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            style="display:none;">
        </iframe>
    `;
    
    return slide;
}

function updateUI(video) {
    const parsed = parseVideoTitle(video.title);
    artistNameEl.textContent = parsed.artist || video.channel;
    albumTitleEl.textContent = parsed.title || video.title;
    
    btnPlaylist.onclick = () => {
        window.open(`https://youtube.com/watch?v=${video.id}`, '_blank');
    };
}

function slideAt(index) {
    return videoWrapper.querySelector(`.video-slide[data-index="${index}"]`);
}

function playVideo(index) {
    if (isNavigating || index < 0 || index >= allVideos.length) return;
    
    isNavigating = true;
    
    const slides = videoWrapper.querySelectorAll('.video-slide');
    slides.forEach((slide, i) => {
        const iframe = slide.querySelector('iframe');
        const thumb = slide.querySelector('.thumbnail-bg');
        
        if (i === index) {
            slide.style.display = 'flex';
            
            let src = iframe.src;
            if (!src.includes('autoplay=1')) {
                src = src.replace('youtube.com/embed/', 'youtube.com/embed?autoplay=1&');
            }
            src = src.replace('mute=0', 'mute=1');
            iframe.src = src;
            iframe.style.display = 'block';
            
            setTimeout(() => {
                iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            }, 100);
            
            thumb.classList.add('hidden');
        } else {
            iframe.style.display = 'none';
            iframe.src = iframe.src.replace('autoplay=1', 'autoplay=0').replace('mute=0', 'mute=1');
            thumb.classList.remove('hidden');
            slide.style.display = 'none';
        }
    });
    
    updateUI(allVideos[index]);
    currentIndex = index;
    isNavigating = false;
}

function navigateTo(index, direction) {
    if (isNavigating || index < 0 || index >= allVideos.length) return;
    
    isNavigating = true;
    const curSlide = slideAt(currentIndex);
    const nextSlide = slideAt(index);
    
    if (!curSlide || !nextSlide) {
        isNavigating = false;
        return;
    }
    
    nextSlide.style.display = 'flex';
    nextSlide.style.transform = direction === 'up' ? 'translateY(100%)' : 'translateY(-100%)';
    
    requestAnimationFrame(() => {
        const duration = 300;
        curSlide.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        nextSlide.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        
        curSlide.style.transform = direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)';
        nextSlide.style.transform = 'translateY(0)';
        
        setTimeout(() => {
            curSlide.style.display = 'none';
            curSlide.style.transform = 'translateY(0)';
            curSlide.style.transition = 'none';
            
            const iframe = curSlide.querySelector('iframe');
            iframe.src = iframe.src.replace('autoplay=1', 'autoplay=0').replace('mute=0', 'mute=1');
            
            const nextIframe = nextSlide.querySelector('iframe');
            nextIframe.style.display = 'block';
            let src = nextIframe.src;
            src = src.replace('mute=1', 'mute=1');
            if (!src.includes('autoplay=1')) {
                src = src.replace('youtube.com/embed/', 'youtube.com/embed?autoplay=1&');
            }
            nextIframe.src = src;
            
            nextSlide.querySelector('.thumbnail-bg').classList.add('hidden');
            
            updateUI(allVideos[index]);
            currentIndex = index;
            isNavigating = false;
        }, duration);
    });
}

function handleTouchStart(e) {
    if (isNavigating) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    isSwiping = true;
    swipeStartTime = Date.now();
    
    const nextSlide = slideAt(currentIndex + 1);
    const prevSlide = slideAt(currentIndex - 1);
    if (nextSlide) { nextSlide.style.transition = 'none'; nextSlide.style.transform = 'translateY(100%)'; nextSlide.style.display = 'flex'; }
    if (prevSlide) { prevSlide.style.transition = 'none'; prevSlide.style.transform = 'translateY(-100%)'; prevSlide.style.display = 'flex'; }
}

function handleTouchMove(e) {
    if (!isSwiping || isNavigating) return;
    e.preventDefault();
    
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    const curSlide = slideAt(currentIndex);
    curSlide.style.transition = 'none';
    curSlide.style.transform = `translateY(${diff}px)`;
    
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
    
    const diff = currentY - startY;
    const swipeTime = Date.now() - swipeStartTime;
    const velocity = Math.abs(diff) / swipeTime;
    const isSwipe = Math.abs(diff) > 50 || velocity > 0.3;
    
    const cleanup = (idx) => {
        const s = slideAt(idx);
        if (s && idx !== currentIndex && idx !== currentIndex + 1 && idx !== currentIndex - 1) {
            s.style.display = 'none';
            s.style.transform = 'translateY(0)';
        }
    };
    
    if (isSwipe && diff < -30 && currentIndex < allVideos.length - 1) {
        navigateTo(currentIndex + 1, 'up');
    } else if (isSwipe && diff > 30 && currentIndex > 0) {
        navigateTo(currentIndex - 1, 'down');
    } else {
        const curSlide = slideAt(currentIndex);
        if (curSlide) {
            curSlide.style.transition = 'transform 0.2s ease';
            curSlide.style.transform = 'translateY(0)';
        }
        
        const nextSlide = slideAt(currentIndex + 1);
        const prevSlide = slideAt(currentIndex - 1);
        
        if (nextSlide && currentIndex < allVideos.length - 1) {
            nextSlide.style.transition = 'transform 0.2s ease';
            nextSlide.style.transform = 'translateY(100%)';
        }
        if (prevSlide && currentIndex > 0) {
            prevSlide.style.transition = 'transform 0.2s ease';
            prevSlide.style.transform = 'translateY(-100%)';
        }
        
        setTimeout(() => {
            cleanup(currentIndex + 2);
            cleanup(currentIndex - 2);
        }, 200);
    }
}

let wheelTimeout;
function handleWheel(e) {
    e.preventDefault();
    
    if (wheelTimeout) return;
    
    wheelTimeout = setTimeout(() => {
        wheelTimeout = null;
    }, 400);
    
    if (e.deltaY > 10) {
        navigateTo(currentIndex + 1, 'up');
    } else if (e.deltaY < -10) {
        navigateTo(currentIndex - 1, 'down');
    }
}

async function loadVideos() {
    if (isLoading) return;
    
    isLoading = true;
    loadingEl.classList.remove('hidden');
    
    allVideos = await fetchAllVideos();
    
    videoWrapper.innerHTML = '';
    allVideos.forEach((video, i) => {
        const slide = createVideoSlide(video, i);
        videoWrapper.appendChild(slide);
    });
    
    loadingEl.classList.add('hidden');
    
    if (allVideos.length > 0) {
        const randomStart = Math.floor(Math.random() * Math.min(10, allVideos.length));
        playVideo(randomStart);
    }
    
    isLoading = false;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
        navigateTo(currentIndex + 1, 'up');
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
        navigateTo(currentIndex - 1, 'down');
    }
});

videoContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
videoContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
videoContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
videoContainer.addEventListener('wheel', handleWheel, { passive: false });

videoContainer.addEventListener('click', (e) => {
    if (isNavigating) return;
    const currentSlide = slideAt(currentIndex);
    if (!currentSlide) return;
    
    const iframe = currentSlide.querySelector('iframe');
    if (!iframe || !iframe.contentWindow) return;
    
    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    
    const playIcon = document.createElement('div');
    playIcon.className = 'play-icon';
    playIcon.innerHTML = '<i class="fa-solid fa-play"></i>';
    playIcon.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:60px;color:white;opacity:0;transition:opacity 0.3s;z-index:100;pointer-events:none;';
    document.body.appendChild(playIcon);
    setTimeout(() => playIcon.style.opacity = '1', 10);
    setTimeout(() => { playIcon.style.opacity = '0'; setTimeout(() => playIcon.remove(), 300); }, 500);
});

loadVideos();
