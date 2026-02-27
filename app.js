const YOUTUBE_API_KEY = 'AIzaSyCzqWoDzcAO7eezfXPfguCwghlDh_ifZs8';
const DISCOGS_TOKEN = 'fvYYQHvhAEHVshXGPHYtbAWSlTUNQpnNJcBBbYCB';

const CHANNEL_SEARCH_TERMS = [
    { name: 'VinylArcheologie', id: 'UCKydEBEvAU5zkN8o1snt62A' },
    { name: 'librariessountracksandrelated', id: 'UCekevJPGTZ44nn_i4SWJDIw' },
    { name: 'andrenavarroII', id: 'UCv5OAW45h67CJEY6kJLyisg' },
    { name: 'oleg_samples', id: 'UC47qc6t2RelhfvI-OjgIY2A' }
];

let channelIds = {};
let allVideos = [];
let currentIndex = 0;
let isLoading = false;
let hasMore = true;
let nextPageToken = '';
let activeVideoId = null;

const videoContainer = document.getElementById('video-container');
const videoWrapper = document.getElementById('video-wrapper');
const loadingEl = document.getElementById('loading');
const discogsLink = document.getElementById('discogs-link');
const youtubeLink = document.getElementById('youtube-link');
const hintEl = document.getElementById('hint');

async function getChannelId(searchTerm) {
    const handle = searchTerm.replace('@', '');
    const url = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&forHandle=${handle}&part=id`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
        return data.items[0].id;
    }
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(handle)}&type=channel&part=snippet&maxResults=1`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.items && searchData.items.length > 0) {
        return searchData.items[0].id.channelId;
    }
    return null;
}

async function fetchChannelVideos(channelId, pageToken = '') {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50&type=video${pageToken ? `&pageToken=${pageToken}` : ''}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.nextPageToken) {
        nextPageToken = data.nextPageToken;
    } else {
        hasMore = false;
    }
    
    return data.items.filter(item => item.id.videoId).map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        published: item.snippet.publishedAt
    }));
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
                title: data.results[0].title,
                thumb: data.results[0].thumb
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
    iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1&playsinline=1`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0;';
    
    slide.appendChild(iframe);
    
    const tag = document.createElement('div');
    tag.className = 'channel-tag';
    tag.textContent = video.channel;
    slide.appendChild(tag);
    
    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = video.title;
    slide.appendChild(title);
    
    return slide;
}

function updateLinks(video) {
    youtubeLink.href = `https://youtube.com/watch?v=${video.id}`;
    
    const parts = video.title.split('-');
    const artist = parts[0]?.trim() || video.channel;
    const track = parts.slice(1).join('-')?.trim() || video.title;
    
    discogsLink.onclick = async (e) => {
        e.preventDefault();
        const discogsData = await searchDiscogs(track, artist);
        if (discogsData) {
            window.open(discogsData.url, '_blank');
        } else {
            window.open(`https://www.discogs.com/search/?q=${encodeURIComponent(artist + ' ' + track)}`, '_blank');
        }
    };
    
    discogsLink.href = '#';
}

function playVideoAtIndex(index) {
    const slides = videoWrapper.querySelectorAll('.video-slide');
    
    slides.forEach((slide, i) => {
        const iframe = slide.querySelector('iframe');
        if (iframe) {
            if (i === index) {
                const videoId = slide.dataset.videoId;
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1&playsinline=1`;
                slide.classList.add('active');
                if (allVideos[index]) {
                    updateLinks(allVideos[index]);
                }
            } else {
                iframe.src = `https://www.youtube.com/embed/${slide.dataset.videoId}?autoplay=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1&playsinline=1`;
                slide.classList.remove('active');
            }
        }
    });
}

async function loadVideos() {
    if (isLoading) return;
    
    isLoading = true;
    loadingEl.classList.remove('hidden');
    
    if (Object.keys(channelIds).length === 0) {
        for (const ch of CHANNEL_SEARCH_TERMS) {
            if (ch.id) {
                channelIds[ch.name] = ch.id;
            }
        }
    }
    
    let newVideos = [];
    for (const ch of CHANNEL_SEARCH_TERMS) {
        if (channelIds[ch.name]) {
            const videos = await fetchChannelVideos(channelIds[ch.name]);
            newVideos = [...newVideos, ...videos];
        }
    }
    
    allVideos = [...allVideos, ...newVideos];
    
    const shuffledVideos = shuffleArray(newVideos);
    
    for (const video of shuffledVideos) {
        const slide = createVideoElement(video, currentIndex);
        videoWrapper.appendChild(slide);
        currentIndex++;
    }
    
    if (allVideos.length > 0) {
        loadingEl.classList.add('hidden');
        playVideoAtIndex(0);
    }
    
    isLoading = false;
    hasMore = false;
}

let scrollTimeout;
function handleScroll() {
    if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
    
    scrollTimeout = requestAnimationFrame(() => {
        const scrollTop = videoContainer.scrollTop;
        const containerHeight = videoContainer.clientHeight;
        const newIndex = Math.round(scrollTop / containerHeight);
        
        if (newIndex >= 0 && newIndex < allVideos.length && newIndex !== currentIndex) {
            currentIndex = newIndex;
            playVideoAtIndex(currentIndex);
            
            if (newIndex >= allVideos.length - 5 && hasMore && !isLoading) {
                loadVideos();
            }
        }
    });
}

videoContainer.addEventListener('scroll', handleScroll, { passive: true });

loadVideos();
