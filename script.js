const videoContainer = document.getElementById('video-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const videoCounter = document.querySelector('.video-counter');
const videoTimeRange = document.querySelector('.video-time-range');
const videoTimestamp = document.querySelector('.video-timestamp');
const videoSender = document.querySelector('.video-sender');

let tiktokLinks = [];
let currentVideoIndex = 0;

async function fetchTikTokLinks() {
    try {
        const response = await fetch('/get-tiktok-links');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        tiktokLinks = await response.json();
        if (tiktokLinks.length > 0) {
            // Calculate and display time range
            const firstVideoDate = new Date(tiktokLinks[tiktokLinks.length - 1].timestamp);
            const lastVideoDate = new Date(tiktokLinks[0].timestamp);
            videoTimeRange.textContent = `Videos from ${firstVideoDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} to ${lastVideoDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;

            loadVideo();
        } else {
            alert('No TikTok links found. Please run the iMessage extractor first.');
        }
    } catch (error) {
        console.error('Error fetching TikTok links:', error);
        alert('Could not fetch TikTok links. Make sure the server is running and the tiktok-links.json file exists.');
    }
}

async function loadVideo() {
    if (tiktokLinks.length === 0 || currentVideoIndex < 0 || currentVideoIndex >= tiktokLinks.length) {
        videoContainer.innerHTML = '';
        videoCounter.textContent = '';
        videoTimestamp.textContent = '';
        videoSender.textContent = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    const currentVideo = tiktokLinks[currentVideoIndex];
    const tiktokUrl = currentVideo.url;
    videoContainer.innerHTML = ''; // Clear the container
    videoCounter.textContent = `Video ${currentVideoIndex + 1} of ${tiktokLinks.length}`;

    const date = new Date(currentVideo.timestamp);
    videoTimestamp.textContent = `Sent: ${date.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}`;
    videoSender.textContent = `From: ${currentVideo.sender}`;

    try {
        const response = await fetch(`/get-oembed?url=${encodeURIComponent(tiktokUrl)}`);
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

        // The oEmbed response includes a script that we need to run to initialize the player
        const scriptTag = embedWrapper.querySelector('script');
        if (scriptTag) {
            const newScript = document.createElement('script');
            newScript.src = scriptTag.src;
            document.body.appendChild(newScript);
        }

    } catch (error) {
        console.error(`Failed to load oEmbed for ${tiktokUrl}:`, error);
        console.warn(`Skipping video ${currentVideoIndex + 1} due to oEmbed error: ${error.message}`);
        currentVideoIndex++;
        loadVideo();
    }
    updateButtonStates();
}

function updateButtonStates() {
    prevBtn.disabled = currentVideoIndex === 0;
    nextBtn.disabled = currentVideoIndex === tiktokLinks.length - 1;
}

prevBtn.addEventListener('click', () => {
    if (currentVideoIndex > 0) {
        currentVideoIndex--;
        loadVideo();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentVideoIndex < tiktokLinks.length - 1) {
        currentVideoIndex++;
        loadVideo();
    }
});

// Initial load
fetchTikTokLinks();