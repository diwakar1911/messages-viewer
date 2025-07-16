const tiktok = require('@mrnima/tiktok-downloader');

// Placeholder for the TikTok links you'll provide
const tiktokLinks = [
    // Add your TikTok links here, for example:
    // 'https://www.tiktok.com/@user/video/1234567890123456789',
];

async function extractVideoUrls() {
    const videoUrls = [];
    for (const link of tiktokLinks) {
        try {
            const result = await tiktok(link, { version: "v1" });
            if (result.status === 'success' && result.data && result.data.video) {
                videoUrls.push(result.data.video);
            }
        } catch (error) {
            console.error(`Error extracting video from ${link}:`, error);
        }
    }
    return videoUrls;
}

extractVideoUrls().then(urls => {
    console.log('Extracted video URLs:');
    console.log(urls);
});
