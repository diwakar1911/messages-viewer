# TikTok Audio Limitation

## The Issue
TikTok videos in the messages viewer are muted by default. This is due to:

1. **Browser autoplay policies**: Modern browsers (Chrome, Safari, Firefox) block autoplay with sound to prevent annoying user experiences
2. **TikTok's embed restrictions**: TikTok's oEmbed service delivers videos muted by default for embedded content
3. **Cross-origin restrictions**: The embedded iframe prevents direct audio control from the parent page

## Why Complex Solutions Don't Work
- **URL parameter manipulation**: TikTok ignores most audio parameters in embedded contexts
- **JavaScript control**: Cross-origin restrictions prevent parent page from controlling iframe audio
- **Server-side modifications**: TikTok's embed service overrides most audio settings

## Simple Solution: User Action Required
The most reliable approach is to let users manually unmute videos:

### How to Unmute TikTok Videos:
1. **Click directly on the video** - This is the most reliable method
2. **Look for the speaker icon** in the video player and click it
3. **Some videos may have a volume slider** in the player controls

### Current App Behavior:
- Videos load muted (this is expected and normal)
- A blue tip appears above each video: "🔊 **Tip:** Click on the video to unmute audio"
- Users can easily unmute by clicking on the video player

## Why This Is Actually Good UX
- **Respects user choice**: Users decide when they want audio
- **Prevents jarring experiences**: No sudden loud audio when browsing
- **Follows web standards**: Matches how other social media embeds work
- **Reliable**: Works consistently across all browsers and devices

## Technical Note
This limitation exists across all TikTok embed implementations, not just this app. Even TikTok's own embeds on other websites require user interaction to unmute.

The current implementation is the most user-friendly approach given these constraints. 