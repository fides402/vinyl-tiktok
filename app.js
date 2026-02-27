const YOUTUBE_API_KEY = 'AIzaSyCzqWoDzcAO7eezfXPfguCwghlDh_ifZs8';
const DISCOGS_TOKEN = 'fvYYQHvhAEHVshXGPHYtbAWSlTUNQpnNJcBBbYCB';

const CHANNEL_IDS = {
    'VinylArcheologie': 'UCKydEBEvAU5zkN8o1snt62A',
    'librariessountracksandrelated': 'UCekevJPGTZ44nn_i4SWJDIw',
    'andrenavarroII': 'UCv5OAW45h67CJEY6kJLyisg',
    'oleg_samples': 'UC47qc6t2RelhfvI-OjgIY2A'
};

let allVideos = [];
let currentIndex = 0;
let isLoading = false;
let isPlaying = false;

const videoContainer = document.getElementById('video-container');
const videoWrapper = document.getElementById('video-wrapper');
const loadingEl = document.getElementById('loading');
const channelNameEl = document.getElementById('channel-name');
const trackNameEl = document.getElementById('track-name');
const trackDetailsEl = document.getElementById('track-details');
const sidebarYoutube = document.getElementById('sidebar-youtube');
const sidebarShuffle = document.getElementById('sidebar-shuffle');
const sidebarShare = document.getElementById('sidebar-share');

let startY = 0;
let currentY = 0;
let isSwiping = false;
let swipeStartTime = 0;

async function fetchChannelVideos(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50&type=video`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        return data.items?.filter(item => item.id.videoId).map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            published: item.snippet.publishedAt
        })) || [];
    } catch (e) {
        console.error('Error fetching videos:', e);
        return [];
    }
}

async function searchDiscogs(trackTitle, artist) {
    const query = encodeURIComponent(`${artist} ${trackTitle}`.slice(0, 100));
    const url = `https://api.discogs.com/database/search?q=${query}&type=release&token=${DISCOGS_TOKEN}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results[0].uri;
        }
    } catch (e) {
        console.log('Discogs search failed:', e);
    }
    return null;
}

function shuffleArray(array) {
    const shuffled = [...array];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

function createVideoSlide(video, index) {
    const slide = document.createElement('div');
    slide.className = 'video-slide';
    slide.dataset.index = index;
    slide.dataset.videoId = video.id;
    slide.dataset.title = video.title;
    slide.dataset.channel = video.channel;
    
    slide.innerHTML = `
        <div class="thumbnail-bg" style="background-image: url(${video.thumbnail})"></div>
        <div class="play-overlay" data-video-id="${video.id}"></div>
        <iframe 
            src="https://www.youtube.com/embed/${video.id}?autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            style="display: none;">
        </iframe>
    `;
    
    return slide;
}

function updateUI(video, index) {
    channelNameEl.textContent = video.channel;
    trackNameEl.textContent = video.title;
    
    const date = new Date(video.published);
    trackDetailsEl.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    
    sidebarYoutube.onclick = () => {
        window.open(`https://youtube.com/watch?v=${video.id}`, '_blank');
    };
    
    sidebarShuffle.onclick = () => {
        shuffleAndRestart();
    };
    
    sidebarShare.onclick = () => {
        if (navigator.share) {
            navigator.share({
                title: video.title,
                text: `Check out: ${video.title}`,
                url: `https://youtube.com/watch?v=${video.id}`
            });
        } else {
            navigator.clipboard.writeText(`https://youtube.com/watch?v=${video.id}`);
            alert('Link copied!');
        }
    };
}

function shuffleAndRestart() {
    allVideos = shuffleArray(allVideos);
    
    videoWrapper.innerHTML = '';
    for (let i = 0; i < allVideos.length; i++) {
        const slide = createVideoSlide(allVideos[i], i);
        videoWrapper.appendChild(slide);
        
        slide.querySelector('.play-overlay').addEventListener('click', () => {
            playVideo(i);
        });
    }
    
    const randomStart = Math.floor(Math.random() * allVideos.length);
    playVideo(randomStart);
}

function playVideo(index) {
    const slides = videoWrapper.querySelectorAll('.video-slide');
    
    slides.forEach((slide, i) => {
        const iframe = slide.querySelector('iframe');
        const thumbBg = slide.querySelector('.thumbnail-bg');
        const playOverlay = slide.querySelector('.play-overlay');
        
        if (i === index) {
            slide.style.display = 'flex';
            slide.style.zIndex = '1';
            
            iframe.style.display = 'block';
            iframe.src = `https://www.youtube.com/embed/${slide.dataset.videoId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`;
            
            thumbBg.classList.add('hidden');
            playOverlay.style.display = 'none';
            
            if (allVideos[index]) {
                updateUI(allVideos[index], index);
            }
        } else {
            slide.style.display = 'none';
            iframe.style.display = 'none';
            iframe.src = '';
            thumbBg.classList.remove('hidden');
            playOverlay.style.display = 'flex';
        }
    });
    
    currentIndex = index;
}

function goToNext() {
    if (currentIndex < allVideos.length - 1) {
        playVideo(currentIndex + 1);
    }
}

function goToPrev() {
    if (currentIndex > 0) {
        playVideo(currentIndex - 1);
    }
}

function handleTouchStart(e) {
    startY = e.touches[0].clientY;
    isSwiping = true;
    swipeStartTime = Date.now();
}

function handleTouchMove(e) {
    if (!isSwiping) return;
    
    currentY = e.touches[0].clientY;
    const diff = startY - currentY;
    
    const slides = videoWrapper.querySelectorAll('.video-slide');
    slides.forEach(slide => {
        if (parseInt(slide.dataset.index) === currentIndex) {
            slide.style.transform = `translateY(${diff}px)`;
            slide.style.transition = 'none';
        }
    });
}

function handleTouchEnd(e) {
    if (!isSwiping) return;
    
    isSwiping = false;
    const diff = startY - currentY;
    const swipeTime = Date.now() - swipeStartTime;
    const velocity = Math.abs(diff) / swipeTime;
    
    const slides = videoWrapper.querySelectorAll('.video-slide');
    slides.forEach(slide => {
        slide.style.transition = 'transform 0.3s ease';
        slide.style.transform = 'translateY(0)';
    });
    
    if (Math.abs(diff) > 100 || velocity > 0.3) {
        if (diff > 0) {
            goToNext();
        } else {
            goToPrev();
        }
    }
}

function handleWheel(e) {
    e.preventDefault();
    
    if (e.deltaY > 50) {
        goToNext();
    } else if (e.deltaY < -50) {
        goToPrev();
    }
}

async function loadVideos() {
    if (isLoading) return;
    
    isLoading = true;
    loadingEl.classList.remove('hidden');
    
    let newVideos = [];
    for (const [name, channelId] of Object.entries(CHANNEL_IDS)) {
        const videos = await fetchChannelVideos(channelId);
        newVideos = [...newVideos, ...videos];
    }
    
    allVideos = shuffleArray(newVideos);
    
    videoWrapper.innerHTML = '';
    
    for (let i = 0; i < allVideos.length; i++) {
        const slide = createVideoSlide(allVideos[i], i);
        videoWrapper.appendChild(slide);
        
        slide.querySelector('.play-overlay').addEventListener('click', () => {
            playVideo(i);
        });
    }
    
    loadingEl.classList.add('hidden');
    
    if (allVideos.length > 0) {
        const randomStart = Math.floor(Math.random() * allVideos.length);
        playVideo(randomStart);
    }
    
    isLoading = false;
}

videoContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
videoContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
videoContainer.addEventListener('touchend', handleTouchEnd, { passive: true });

videoContainer.addEventListener('wheel', handleWheel, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
        goToNext();
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
        goToPrev();
    }
});

loadVideos();
