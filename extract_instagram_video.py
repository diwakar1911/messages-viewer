#!/usr/bin/env python3
import yt_dlp
import sys
import json

def extract_instagram_video(url):
    try:
        # Configure yt-dlp with options to get best quality video
        ydl_opts = {
            'format': 'best[ext=mp4]',  # Get best quality mp4
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'no_color': True,
            'ignoreerrors': True,
            # Add headers to potentially help with CORS
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract video information
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return {
                    'success': False,
                    'error': 'No video information found'
                }
            
            # Get video URL - try different quality options
            video_url = None
            formats = info.get('formats', [])
            
            # Try to find a good quality video format
            for fmt in formats:
                if fmt.get('ext') == 'mp4' and fmt.get('vcodec') != 'none':
                    video_url = fmt.get('url')
                    break
            
            # Fallback to any video URL
            if not video_url:
                video_url = info.get('url')
            
            if not video_url:
                return {
                    'success': False,
                    'error': 'No video URL found'
                }
            
            # Extract metadata
            title = info.get('title', 'Instagram Video')
            uploader = info.get('uploader', 'Instagram User')
            thumbnail = info.get('thumbnail', '')
            duration = info.get('duration', 0)
            
            return {
                'success': True,
                'video_url': video_url,
                'title': title,
                'uploader': uploader,
                'thumbnail': thumbnail,
                'duration': duration,
                'formats_available': len(formats)
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': f'Extraction failed: {str(e)}'
        }

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python extract_instagram_video.py <instagram_url>'
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    result = extract_instagram_video(url)
    print(json.dumps(result, ensure_ascii=False)) 