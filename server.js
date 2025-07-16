const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/get-video-links', (req, res) => {
    const linksPath = path.join(__dirname, 'video-links.json');
    fs.readFile(linksPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading video-links.json:', err);
            if (err.code === 'ENOENT') {
                return res.status(404).send({ error: 'video-links.json not found. Have you run the iMessage extractor?' });
            }
            return res.status(500).send({ error: 'Failed to read video links file.' });
        }
        res.send(JSON.parse(data));
    });
});

app.get('/get-oembed', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) {
        return res.status(400).send({ error: 'URL is required' });
    }

    console.log(`Fetching oEmbed for URL: ${videoUrl}`);
    try {
        let oembedUrl;
        
        if (videoUrl.includes('tiktok.com')) {
            // TikTok has public oEmbed API
            oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
        } else if (videoUrl.includes('instagram.com')) {
            // Hybrid approach: try iframe embed with fallback
            const instagramId = videoUrl.match(/\/(?:p|reel|tv)\/([^\/]+)/)?.[1];
            if (instagramId) {
                const embedUrl = `https://www.instagram.com/p/${instagramId}/embed/?cr=1&v=14&wp=540`;
                
                return res.send({
                    type: 'rich',
                    version: '1.0',
                    title: 'Instagram Reel',
                    author_name: 'Instagram',
                    provider_name: 'Instagram',
                    provider_url: 'https://www.instagram.com',
                    html: `
                        <div style="width: 100%; max-width: 400px; margin: 0 auto; position: relative;">
                            <!-- Try iframe embed first -->
                            <iframe 
                                id="instagram-iframe-${instagramId}"
                                src="${embedUrl}"
                                width="400" 
                                height="480" 
                                frameborder="0" 
                                scrolling="no" 
                                allowtransparency="true"
                                allow="encrypted-media; autoplay; clipboard-write; gyroscope; picture-in-picture; web-share"
                                allowfullscreen="true"
                                style="border: none; overflow: hidden; width: 100%; height: 480px; border-radius: 8px;"
                                onload="this.style.display='block'; this.nextElementSibling.style.display='none';"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            ></iframe>
                            
                            <!-- Fallback for when iframe is blocked -->
                            <div style="display: flex; width: 100%; height: 480px; border: 2px solid #E1306C; border-radius: 12px; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7); cursor: pointer; position: relative;" onclick="window.open('${videoUrl}', '_blank')">
                                <div style="background: white; border-radius: 8px; padding: 20px; text-align: center; margin: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="#E1306C"/>
                                    </svg>
                                    <h3 style="margin: 15px 0 10px 0; color: #333; font-family: Arial, sans-serif;">Instagram Reel</h3>
                                    <p style="margin: 0; color: #666; font-size: 14px; font-family: Arial, sans-serif;">Click to view on Instagram</p>
                                    <div style="margin-top: 15px; padding: 8px 16px; background: #E1306C; color: white; border-radius: 20px; font-size: 14px; font-weight: bold; display: inline-block;">
                                        View Reel ▶
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <script>
                            // Check if iframe loaded successfully after a short delay
                            setTimeout(function() {
                                var iframe = document.getElementById('instagram-iframe-${instagramId}');
                                var fallback = iframe.nextElementSibling;
                                
                                // If iframe is blocked or failed to load, show fallback
                                try {
                                    iframe.contentWindow.location.href;
                                    // If we can access iframe content, it loaded successfully
                                    fallback.style.display = 'none';
                                } catch (e) {
                                    // If we can't access iframe content, it's likely blocked
                                    iframe.style.display = 'none';
                                    fallback.style.display = 'flex';
                                }
                            }, 2000);
                        </script>
                    `,
                    width: 400,
                    height: 480,
                    thumbnail_url: '',
                    platform: 'instagram'
                });
            } else {
                return res.status(400).send({ error: 'Could not parse Instagram URL' });
            }
        } else {
            return res.status(400).send({ error: 'Unsupported platform' });
        }

        const response = await axios.get(oembedUrl);
        // Add platform identifier to the response
        const responseData = response.data;
        responseData.platform = 'tiktok';
        res.send(responseData);
    } catch (error) {
        console.error('Error fetching oEmbed data:', error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).send({ error: 'Failed to fetch oEmbed data.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Open index.html in your browser to use the viewer.');
});
