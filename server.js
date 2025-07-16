const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/get-tiktok-links', (req, res) => {
    const linksPath = path.join(__dirname, 'tiktok-links.json');
    fs.readFile(linksPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading tiktok-links.json:', err);
            if (err.code === 'ENOENT') {
                return res.status(404).send({ error: 'tiktok-links.json not found. Have you run the iMessage extractor?' });
            }
            return res.status(500).send({ error: 'Failed to read TikTok links file.' });
        }
        res.send(JSON.parse(data));
    });
});

app.get('/get-oembed', async (req, res) => {
    const tiktokUrl = req.query.url;
    if (!tiktokUrl) {
        return res.status(400).send({ error: 'URL is required' });
    }

    console.log(`Fetching oEmbed for URL: ${tiktokUrl}`);
    try {
        const response = await axios.get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`);
        res.send(response.data);
    } catch (error) {
        console.error('Error fetching oEmbed data:', error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).send({ error: 'Failed to fetch oEmbed data.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Open index.html in your browser to use the viewer.');
});
