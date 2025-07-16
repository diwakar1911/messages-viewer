import sqlite3
import json
import os
import datetime
import re
from NSKeyedUnArchiver import unserializeNSKeyedArchiver
from urllib.parse import urlparse, parse_qs

# Path to the iMessage database
db_path = os.path.join(os.path.expanduser('~'), 'Library', 'Messages', 'chat.db')
output_file = 'tiktok-links.json'

def mac_time_to_datetime(mac_time):
    """Converts Apple's Core Data timestamp (nanoseconds since 2001-01-01) to a datetime object."""
    if mac_time is None:
        return None
    # iMessage date is nanoseconds since 2001-01-01 00:00:00 UTC
    mac_epoch = datetime.datetime(2001, 1, 1, tzinfo=datetime.timezone.utc)
    return mac_epoch + datetime.timedelta(microseconds=mac_time / 1000)

def clean_and_normalize_url(url):
    """Clean and normalize a TikTok URL to remove corrupted data and extract the core URL."""
    if not url:
        return None
    
    # Remove any binary/control characters and extra whitespace
    url = re.sub(r'[^\x20-\x7E]', '', url).strip()
    
    # Extract base TikTok URL patterns
    # Handle different TikTok URL formats
    tiktok_patterns = [
        r'(https?://(?:www\.)?(?:m\.)?tiktok\.com/t/[A-Za-z0-9]+)',
        r'(https?://(?:www\.)?(?:m\.)?tiktok\.com/@[^/]+/video/\d+)',
        r'(https?://(?:www\.)?vm\.tiktok\.com/[A-Za-z0-9]+)',
        r'(https?://(?:www\.)?(?:m\.)?tiktok\.com/video/\d+)'
    ]
    
    for pattern in tiktok_patterns:
        match = re.search(pattern, url)
        if match:
            clean_url = match.group(1)
            # Ensure URL ends properly (no trailing junk)
            if not clean_url.endswith('/'):
                clean_url += '/'
            return clean_url
    
    return None

def find_urls_in_nsattributed_string(obj, url_regex, found_urls):
    """Recursively searches for URLs within a deserialized NSAttributedString object."""
    if isinstance(obj, dict):
        # Look for NSLinkAttributeName or NSLink which often hold URLs
        if 'NSLinkAttributeName' in obj and isinstance(obj['NSLinkAttributeName'], str):
            url = clean_and_normalize_url(obj['NSLinkAttributeName'])
            if url:
                found_urls.add(url)
        elif 'NSLink' in obj and isinstance(obj['NSLink'], str):
            url = clean_and_normalize_url(obj['NSLink'])
            if url:
                found_urls.add(url)
        
        # Recursively search nested objects
        for key, value in obj.items():
            find_urls_in_nsattributed_string(value, url_regex, found_urls)
    elif isinstance(obj, list):
        for item in obj:
            find_urls_in_nsattributed_string(item, url_regex, found_urls)
    elif isinstance(obj, str):
        # Also check plain strings that might be part of the attributed string
        # But be more careful about extracting URLs from potentially corrupted strings
        if 'tiktok.com' in obj or 'vm.tiktok.com' in obj:
            url = clean_and_normalize_url(obj)
            if url:
                found_urls.add(url)

def extract_rich_tiktok_links(days_back=30):
    tiktok_links = {} # Use a dictionary to store unique links, keyed by URL

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Calculate the cutoff date for filtering messages
        cutoff_datetime = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_back)
        # Convert cutoff_datetime to iMessage timestamp format (nanoseconds since 2001-01-01)
        mac_epoch = datetime.datetime(2001, 1, 1, tzinfo=datetime.timezone.utc)
        cutoff_mac_time = (cutoff_datetime - mac_epoch).total_seconds() * 1000000000 # Convert to nanoseconds

        query = f"""
            SELECT
                message.text,
                message.date,
                handle.id AS sender,
                message.attributedBody
            FROM
                message
            JOIN
                handle ON message.handle_id = handle.ROWID
            WHERE
                message.is_from_me = 0
                AND message.date >= {int(cutoff_mac_time)}
            ORDER BY
                message.date DESC;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        # Improved regex for TikTok URLs - more restrictive to avoid capturing junk
        url_regex = re.compile(r'https?://(?:www\.)?(?:m\.)?(?:tiktok\.com|vm\.tiktok\.com)/[A-Za-z0-9/@]+')

        for row in rows:
            text_content, mac_time, sender, attributed_body_blob = row
            
            timestamp = mac_time_to_datetime(mac_time)
            if not timestamp:
                continue

            current_message_urls = set()

            # 1. Extract from plain text content
            if text_content:
                matches = url_regex.findall(text_content)
                for match in matches:
                    url = clean_and_normalize_url(match)
                    if url:
                        current_message_urls.add(url)
            
            # 2. Extract from attributedBody BLOB
            if attributed_body_blob:
                try:
                    # Deserialize the attributedBody BLOB
                    unarchived_data = unserializeNSKeyedArchiver(attributed_body_blob)
                    find_urls_in_nsattributed_string(unarchived_data, url_regex, current_message_urls)
                except Exception as e:
                    # Silently ignore errors for non-deserializable BLOBs
                    pass

            # Add found URLs to the main tiktok_links dictionary
            for url in current_message_urls:
                if url not in tiktok_links or timestamp > tiktok_links[url]['timestamp']:
                    tiktok_links[url] = {
                        'url': url,
                        'timestamp': timestamp,
                        'sender': sender
                    }
        
        # Convert datetime objects to ISO format for JSON serialization and sort
        sorted_links = sorted(tiktok_links.values(), key=lambda x: x['timestamp'], reverse=True)
        final_links = []
        for link in sorted_links:
            final_links.append({
                'url': link['url'],
                'timestamp': link['timestamp'].isoformat(),
                'sender': link['sender']
            })

        with open(output_file, 'w') as f:
            json.dump(final_links, f, indent=2)
        
        print(f"Successfully extracted {len(final_links)} unique TikTok links to {output_file}")
        
        # Also output a summary
        print(f"\nSummary:")
        print(f"- Total unique URLs: {len(final_links)}")
        print(f"- Date range: {final_links[-1]['timestamp'] if final_links else 'N/A'} to {final_links[0]['timestamp'] if final_links else 'N/A'}")
        
        return final_links

    except Exception as e:
        print(f"Error extracting TikTok links: {e}")
        print("Please ensure you have granted Full Disk Access to your terminal for the iMessage database.")
        return []

if __name__ == "__main__":
    extract_rich_tiktok_links(days_back=30)
