const videoContainer = document.getElementById('video-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const videoCounter = document.querySelector('.video-counter');
const videoTimeRange = document.querySelector('.video-time-range');
const videoTimestamp = document.querySelector('.video-timestamp');
const videoSender = document.querySelector('.video-sender');

let videoLinks = [];
let currentVideoIndex = 0;

async function fetchVideoLinks() {
    try {
        const response = await fetch('/get-video-links');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        videoLinks = await response.json();
        if (videoLinks.length > 0) {
            updateTimeRange();
            loadVideo();
        } else {
            alert('No video links found. Please run the iMessage extractor first.');
        }
    } catch (error) {
        console.error('Error fetching video links:', error);
        alert('Could not fetch video links. Make sure the server is running and the video-links.json file exists.');
    }
}

function updateTimeRange() {
    if (videoLinks.length > 0) {
        const newest = new Date(videoLinks[0].timestamp);
        const oldest = new Date(videoLinks[videoLinks.length - 1].timestamp);
        
        const formatDate = (date) => {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
        };
        
        videoTimeRange.textContent = `${formatDate(oldest)} - ${formatDate(newest)}`;
    } else {
        videoTimeRange.textContent = '';
    }
}

function getPlatformFromUrl(url) {
    if (url.includes('tiktok.com')) {
        return 'tiktok';
    } else if (url.includes('instagram.com')) {
        return 'instagram';
    }
    return 'unknown';
}

async function loadVideo() {
    if (videoLinks.length === 0 || currentVideoIndex < 0 || currentVideoIndex >= videoLinks.length) {
        videoContainer.innerHTML = '';
        videoCounter.textContent = '';
        videoTimestamp.textContent = '';
        videoSender.textContent = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    const currentVideo = videoLinks[currentVideoIndex];
    const videoUrl = currentVideo.url;
    const platform = getPlatformFromUrl(videoUrl);
    
    videoContainer.innerHTML = ''; // Clear the container
    videoCounter.textContent = `Video ${currentVideoIndex + 1} of ${videoLinks.length}`;

    const date = new Date(currentVideo.timestamp);
    videoTimestamp.textContent = `Sent: ${date.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}`;
    videoSender.textContent = `From: ${currentVideo.sender}`;

    try {
        const response = await fetch(`/get-oembed?url=${encodeURIComponent(videoUrl)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        let oembedHtml = data.html;

        // Create a wrapper div for the embed
        const embedWrapper = document.createElement('div');
        embedWrapper.className = 'embed-wrapper';
        embedWrapper.innerHTML = oembedHtml;
        videoContainer.appendChild(embedWrapper);

        // Platform-specific handling
        if (platform === 'tiktok') {
            // The oEmbed response includes a script that we need to run to initialize the player
            const scriptTag = embedWrapper.querySelector('script');
            if (scriptTag) {
                const newScript = document.createElement('script');
                newScript.src = scriptTag.src;
                document.body.appendChild(newScript);
            }
        } else if (platform === 'instagram') {
            // Instagram direct video - no special handling needed
            console.log('Loading Instagram video...');
            
            const videoElement = embedWrapper.querySelector('video');
            
            if (videoElement) {
                // Log when video loads
                videoElement.addEventListener('loadeddata', function() {
                    console.log('Instagram video loaded successfully');
                });
                
                // Log any errors
                videoElement.addEventListener('error', function(e) {
                    console.error('Instagram video error:', e);
                });
                
                // Try to play the video
                videoElement.play().catch(e => {
                    console.log('Autoplay blocked:', e);
                });
            }
        }

    } catch (error) {
        console.error(`Failed to load oEmbed for ${videoUrl}:`, error);
        console.warn(`Skipping video ${currentVideoIndex + 1} due to oEmbed error: ${error.message}`);
        currentVideoIndex++;
        loadVideo();
    }
    updateButtonStates();
}

function updateButtonStates() {
    prevBtn.disabled = currentVideoIndex === 0;
    nextBtn.disabled = currentVideoIndex === videoLinks.length - 1;
}

prevBtn.addEventListener('click', () => {
    if (currentVideoIndex > 0) {
        currentVideoIndex--;
        loadVideo();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentVideoIndex < videoLinks.length - 1) {
        currentVideoIndex++;
        loadVideo();
    }
});

// Initial load
fetchVideoLinks();