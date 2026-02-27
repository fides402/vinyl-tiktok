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
let isInitialized = false;

const videoContainer = document.getElementById('video-container');
const videoWrapper = document.getElementById('video-wrapper');
const loadingEl = document.getElementById('loading');
const discogsLink = document.getElementById('discogs-link');
const youtubeLink = document.getElementById('youtube-link');
const hintEl = document.getElementById('hint');

async function fetchChannelVideos(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50&type=video`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.items?.filter(item => item.id.videoId).map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        published: item.snippet.publishedAt
    })) || [];
}

async function searchDiscogs(trackTitle, artist) {
    const query = encodeURIComponent(`${artist} ${trackTitle}`.slice(0, 100));
    const url = `https://api.discogs.com/database/search?q=${query}&type=release&token=${DISCOGS_TOKEN}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return {
                url: data.results[0].uri,
                title: data.results[0].title
            };
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

function createVideoElement(video, index) {
    const slide = document.createElement('div');
    slide.className = 'video-slide';
    slide.dataset.index = index;
    slide.dataset.videoId = video.id;
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&enablejsapi=1`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    
    slide.appendChild(iframe);
    
    const tag = document.createElement('div');
    tag.className = 'channel-tag';
    tag.textContent = video.channel;
    slide.appendChild(tag);
    
    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = video.title;
    slide.appendChild(title);
    
    const number = document.createElement('div');
    number.className = 'video-number';
    number.textContent = `${index + 1} / ${allVideos.length}`;
    slide.appendChild(number);
    
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    
    const discInfo = document.createElement('div');
    discInfo.className = 'disc-info';
    
    const discLink = discogsLink.cloneNode(true);
    discLink.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parts = video.title.split('-');
        const artist = parts[0]?.trim() || video.channel;
        const track = parts.slice(1).join('-')?.trim() || video.title;
        
        const discogsData = await searchDiscogs(track, artist);
        if (discogsData) {
            window.open(discogsData.url, '_blank');
        } else {
            window.open(`https://www.discogs.com/search/?q=${encodeURIComponent(artist + ' ' + track)}`, '_blank');
        }
    };
    
    const ytLink = youtubeLink.cloneNode(true);
    ytLink.href = `https://youtube.com/watch?v=${video.id}`;
    ytLink.target = '_blank';
    
    discInfo.appendChild(discLink);
    discInfo.appendChild(ytLink);
    overlay.appendChild(discInfo);
    slide.appendChild(overlay);
    
    return slide;
}

function playVideoAtIndex(index) {
    const slides = videoWrapper.querySelectorAll('.video-slide');
    
    slides.forEach((slide, i) => {
        const iframe = slide.querySelector('iframe');
        const numberEl = slide.querySelector('.video-number');
        
        if (i === index) {
            const videoId = slide.dataset.videoId;
            iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&enablejsapi=1`;
            slide.classList.add('active');
            
            if (numberEl) {
                numberEl.textContent = `${index + 1} / ${allVideos.length}`;
            }
            
            updateLinks(allVideos[index]);
        } else {
            const oldVideoId = slide.dataset.videoId;
            iframe.src = `https://www.youtube.com/embed/${oldVideoId}?autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`;
            slide.classList.remove('active');
        }
    });
    
    currentIndex = index;
}

function updateLinks(video) {
    const parts = video.title.split('-');
    const artist = parts[0]?.trim() || video.channel;
    const track = parts.slice(1).join('-')?.trim() || video.title;
    
    youtubeLink.href = `https://youtube.com/watch?v=${video.id}`;
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
        const slide = createVideoElement(allVideos[i], i);
        videoWrapper.appendChild(slide);
    }
    
    loadingEl.classList.add('hidden');
    
    if (allVideos.length > 0) {
        setTimeout(() => {
            playVideoAtIndex(0);
            videoContainer.scrollTo({ top: 0, behavior: 'auto' });
        }, 100);
    }
    
    isLoading = false;
    setupScrollListener();
}

function setupScrollListener() {
    if (isInitialized) return;
    isInitialized = true;
    
    let scrollTimeout;
    
    videoContainer.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(() => {
            const scrollTop = videoContainer.scrollTop;
            const containerHeight = videoContainer.clientHeight;
            const newIndex = Math.round(scrollTop / containerHeight);
            
            if (newIndex >= 0 && newIndex < allVideos.length && newIndex !== currentIndex) {
                playVideoAtIndex(newIndex);
            }
        }, 100);
    }, { passive: true });
}

loadVideos();
