const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Add cache control headers to prevent caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

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
            // Extract direct video URL using yt-dlp
            const { spawn } = require('child_process');
            
            return new Promise((resolve, reject) => {
                const python = spawn('python', ['extract_instagram_video.py', videoUrl]);
                
                let output = '';
                let errorOutput = '';
                
                python.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                python.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                python.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`Python script failed with code ${code}: ${errorOutput}`);
                        return res.status(500).send({ error: 'Failed to extract Instagram video' });
                    }
                    
                    try {
                        const result = JSON.parse(output);
                        
                        if (!result.success) {
                            console.error('Instagram extraction failed:', result.error);
                            return res.status(500).send({ error: result.error });
                        }
                        
                        const videoId = Date.now();
                        
                        // Return simple direct video embed without muted attribute
                        return res.send({
                            type: 'video',
                            version: '1.0',
                            title: result.title,
                            author_name: result.uploader,
                            provider_name: 'Instagram',
                            provider_url: 'https://www.instagram.com',
                            html: `
                                <div class="instagram-video-container" style="position: relative; width: 100%; max-width: 325px; margin: 0 auto; background: #000; border-radius: 8px; overflow: hidden;">
                                    <video 
                                        id="instagram-video-${videoId}"
                                        controls 
                                        loop 
                                        style="width: 100%; height: auto; display: block;"
                                        poster="${result.thumbnail}"
                                        preload="metadata"
                                        autoplay
                                    >
                                        <source src="${result.video_url}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                            `,
                            width: 325,
                            height: Math.round(325 * 16/9),
                            thumbnail_url: result.thumbnail,
                            platform: 'instagram'
                        });
                        
                    } catch (parseError) {
                        console.error('Failed to parse Python output:', parseError);
                        return res.status(500).send({ error: 'Failed to parse extraction result' });
                    }
                });
            });
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
