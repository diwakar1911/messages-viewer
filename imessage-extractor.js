const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');

// Path to the iMessage database
const dbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

function extractVideoId(url) {
    let videoId = null;
    // Regex for common TikTok video ID patterns
    const patterns = [
        /tiktok\.com\/[^\/]+\/video\/(\d+)/, // e.g., tiktok.com/@user/video/12345
        /tiktok\.com\/t\/([a-zA-Z0-9]+)/, // e.g., tiktok.com/t/shortcode
        /vm\.tiktok\.com\/([a-zA-Z0-9]+)/, // e.g., vm.tiktok.com/shortcode
        /m\.tiktok\.com\/[^\/]+\/video\/(\d+)/ // e.g., m.tiktok.com/@user/video/12345
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            videoId = match[1];
            break;
        }
    }
    return videoId;
}

function normalizeTikTokUrl(url) {
    const videoId = extractVideoId(url);
    if (videoId) {
        // Construct a canonical URL using the video ID
        return `https://www.tiktok.com/video/${videoId}`;
    }
    // If no video ID found, return the original URL (or a more basic normalized version)
    try {
        const urlObj = new URL(url);
        // Remove common tracking parameters or unnecessary query params
        urlObj.searchParams.forEach((value, key) => {
            if (key.startsWith('_d') || key.startsWith('_r') || key.startsWith('lang') || key.startsWith('is_copy_url') || key.startsWith('is_from_webapp') || key.startsWith('checksum') || key.startsWith('tt_from') || key.startsWith('u_code') || key.startsWith('ug_btm') || key.startsWith('user_id') || key.startsWith('utm_campaign') || key.startsWith('utm_medium') || key.startsWith('utm_source') || key.startsWith('share_app_id') || key.startsWith('share_item_id') || key.startsWith('share_link_id') || key.startsWith('share_scene') || key.startsWith('sharer_language') || key.startsWith('social_share_type') || key.startsWith('timestamp')) {
                urlObj.searchParams.delete(key);
            }
        });
        // Ensure consistent domain (e.g., vm.tiktok.com or m.tiktok.com -> www.tiktok.com)
        if (urlObj.hostname === 'vm.tiktok.com' || urlObj.hostname === 'm.tiktok.com') {
            urlObj.hostname = 'www.tiktok.com';
        }
        // Remove trailing slash if it's not the root
        let normalized = urlObj.toString();
        if (normalized.endsWith('/') && urlObj.pathname !== '/') {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    } catch (e) {
        return url; // Return original if parsing fails
    }
}

function findTikTokLinks(callback) {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            return callback(err);
        }
        console.log('Connected to the iMessage database.');
    });

    const urlRegex = /(https?:\/\/(?:www\.)?(?:m\.)?(?:tiktok\.com|vm\.tiktok\.com)\/[^\s]+)/g;
    const linksMap = new Map();

    const query = `
        SELECT
            message.text,
            message.date,
            handle.id AS sender,
            message.attributedBody,
            message.payload_data,
            message.balloon_bundle_id
        FROM
            message
        JOIN
            handle ON message.handle_id = handle.ROWID
        WHERE
            message.is_from_me = 0
            AND (
                message.text LIKE '%tiktok.com%' OR
                message.attributedBody LIKE '%tiktok.com%' OR
                message.payload_data LIKE '%tiktok.com%' OR
                message.balloon_bundle_id = 'com.apple.messages.URLBalloonProvider'
            )
        ORDER BY
            message.date DESC;
    `;

    console.log('Searching for TikTok links in your iMessages...');
    db.all(query, [], (err, rows) => {
        db.close();
        if (err) {
            return callback(err);
        }

        rows.forEach(row => {
            let potentialLinks = new Set();

            // Check message.text
            if (row.text) {
                let match;
                while ((match = urlRegex.exec(row.text))) {
                    potentialLinks.add(match[1]);
                }
            }

            // Check attributedBody (convert BLOB to string)
            if (row.attributedBody) {
                try {
                    const attributedBodyStr = row.attributedBody.toString('utf8'); // Attempt to convert BLOB to string
                    let match;
                    while ((match = urlRegex.exec(attributedBodyStr))) {
                        potentialLinks.add(match[1]);
                    }
                } catch (e) {
                    // console.error('Error converting attributedBody to string:', e);
                }
            }

            // Check payload_data (convert BLOB to string)
            if (row.payload_data) {
                try {
                    const payloadDataStr = row.payload_data.toString('utf8'); // Attempt to convert BLOB to string
                    let match;
                    while ((match = urlRegex.exec(payloadDataStr))) {
                        potentialLinks.add(match[1]);
                    }
                } catch (e) {
                    // console.error('Error converting payload_data to string:', e);
                }
            }

            // If it's a URLBalloonProvider message, it's highly likely to contain a link
            if (row.balloon_bundle_id === 'com.apple.messages.URLBalloonProvider' && row.text) {
                let match;
                while ((match = urlRegex.exec(row.text))) {
                    potentialLinks.add(match[1]);
                }
            }

            // Add found URLs to the main linksMap
            potentialLinks.forEach(url => {
                const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
                const timestamp = new Date(macEpoch + (row.date / 1000000));

                if (linksMap.has(url)) {
                    const existingLink = linksMap.get(url);
                    if (timestamp.getTime() > existingLink.timestamp.getTime()) {
                        linksMap.set(url, { url, timestamp, sender: row.sender });
                    }
                } else {
                    linksMap.set(url, { url, timestamp, sender: row.sender });
                }
            });
        });

        const linksWithDetails = Array.from(linksMap.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        console.log(`Found ${linksWithDetails.length} unique TikTok links.`);
        callback(null, linksWithDetails);
    });
}

findTikTokLinks((err, links) => {
    if (err) {
        console.error('Error accessing iMessage database:', err.message);
        console.error('Please ensure you have granted Full Disk Access to your terminal.');
        return;
    }

    if (links.length === 0) {
        console.log('No TikTok links found in your iMessages.');
        return;
    }

    fs.writeFileSync('tiktok-links.json', JSON.stringify(links.map(link => ({ ...link, timestamp: link.timestamp.toISOString() })), null, 2));
    console.log(`Successfully saved ${links.length} TikTok links to tiktok-links.json`);
    console.log('Next, I will start the server and you can open the viewer in your browser.');
});
