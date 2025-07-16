import sqlite3
import json
import os
import datetime
import re
from urllib.parse import urlparse, unquote

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

def clean_and_normalize_tiktok_url(url):
    """Clean and normalize a TikTok URL to remove corrupted data."""
    if not url:
        return None
    
    # Remove any binary/control characters and decode if needed
    try:
        # Remove control characters but keep basic punctuation and alphanumeric
        cleaned = re.sub(r'[^\x20-\x7E]', '', str(url)).strip()
        
        # Extract different TikTok URL patterns
        patterns = [
            r'(https?://(?:www\.)?tiktok\.com/t/[A-Za-z0-9]+)',
            r'(https?://(?:www\.)?m\.tiktok\.com/t/[A-Za-z0-9]+)',
            r'(https?://(?:www\.)?vm\.tiktok\.com/[A-Za-z0-9]+)',
            r'(https?://(?:www\.)?tiktok\.com/@[A-Za-z0-9_.]+/video/\d+)',
            r'(https?://(?:www\.)?m\.tiktok\.com/@[A-Za-z0-9_.]+/video/\d+)',
            r'(https?://(?:www\.)?tiktok\.com/video/\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, cleaned)
            if match:
                clean_url = match.group(1)
                # Normalize to standard format
                clean_url = clean_url.replace('m.tiktok.com', 'www.tiktok.com')
                clean_url = clean_url.replace('vm.tiktok.com', 'www.tiktok.com')
                
                # Ensure it ends with / for consistency
                if not clean_url.endswith('/'):
                    clean_url += '/'
                
                return clean_url
        
        return None
    except Exception:
        return None

def extract_urls_from_binary(binary_data):
    """Extract TikTok URLs from binary data (attributedBody BLOB)."""
    if not binary_data:
        return set()
    
    urls = set()
    
    try:
        # Convert binary data to string, ignoring errors
        text_data = binary_data.decode('utf-8', errors='ignore')
        
        # Look for TikTok URLs in the decoded text
        # Use a more comprehensive pattern to catch various formats
        tiktok_pattern = r'https?://[^\s]*(?:tiktok\.com|vm\.tiktok\.com)[^\s]*'
        
        matches = re.findall(tiktok_pattern, text_data)
        
        for match in matches:
            # Clean each match
            clean_url = clean_and_normalize_tiktok_url(match)
            if clean_url:
                urls.add(clean_url)
    
    except Exception:
        pass
    
    return urls

def extract_rich_tiktok_links(days_back=60, from_sender=None):  # Extended default to 60 days
    tiktok_links = {}  # Use a dictionary to store unique links, keyed by URL

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Calculate the cutoff date for filtering messages
        cutoff_datetime = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_back)
        # Convert cutoff_datetime to iMessage timestamp format (nanoseconds since 2001-01-01)
        mac_epoch = datetime.datetime(2001, 1, 1, tzinfo=datetime.timezone.utc)
        cutoff_mac_time = (cutoff_datetime - mac_epoch).total_seconds() * 1000000000  # Convert to nanoseconds

        # Build the query with optional sender filtering
        base_query = """
            SELECT
                message.text,
                message.date,
                handle.id AS sender,
                message.attributedBody,
                message.is_from_me
            FROM
                message
            LEFT JOIN
                handle ON message.handle_id = handle.ROWID
            WHERE
                message.date >= {cutoff_time}
        """
        
        # Add sender filtering if specified
        if from_sender:
            if from_sender.lower() == 'you' or from_sender.lower() == 'me':
                base_query += " AND message.is_from_me = 1"
            else:
                # Only include messages from the specific sender (not from user)
                base_query += f" AND message.is_from_me = 0 AND handle.id = '{from_sender}'"
        
        base_query += " ORDER BY message.date DESC;"
        
        query = base_query.format(cutoff_time=int(cutoff_mac_time))
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        sender_filter_msg = f" from {from_sender}" if from_sender else ""
        print(f"Processing {len(rows)} messages{sender_filter_msg} from the last {days_back} days...")

        for row in rows:
            text_content, mac_time, sender, attributed_body_blob, is_from_me = row
            
            timestamp = mac_time_to_datetime(mac_time)
            if not timestamp:
                continue

            # Handle sender display
            if is_from_me:
                sender_display = "You"
            else:
                sender_display = sender or "Unknown"

            current_message_urls = set()

            # 1. Extract from plain text content
            if text_content:
                clean_url = clean_and_normalize_tiktok_url(text_content)
                if clean_url:
                    current_message_urls.add(clean_url)
            
            # 2. Extract from attributedBody BLOB (raw binary approach)
            if attributed_body_blob:
                binary_urls = extract_urls_from_binary(attributed_body_blob)
                current_message_urls.update(binary_urls)

            # Add found URLs to the main tiktok_links dictionary
            # Keep only the most recent timestamp for each URL
            for url in current_message_urls:
                if url not in tiktok_links or timestamp > tiktok_links[url]['timestamp']:
                    tiktok_links[url] = {
                        'url': url,
                        'timestamp': timestamp,
                        'sender': sender_display
                    }
        
        # Convert datetime objects to ISO format for JSON serialization and sort by timestamp
        sorted_links = sorted(tiktok_links.values(), key=lambda x: x['timestamp'], reverse=True)
        final_links = []
        for link in sorted_links:
            final_links.append({
                'url': link['url'],
                'timestamp': link['timestamp'].isoformat(),
                'sender': link['sender']
            })

        # Save to JSON file
        with open(output_file, 'w') as f:
            json.dump(final_links, f, indent=2)
        
        print(f"Successfully extracted {len(final_links)} unique TikTok links to {output_file}")
        
        # Also output a summary
        print(f"\nSummary:")
        print(f"- Total unique URLs: {len(final_links)}")
        if final_links:
            print(f"- Most recent: {final_links[0]['timestamp']}")
            print(f"- Oldest: {final_links[-1]['timestamp']}")
            print(f"- Sample URLs:")
            for i, link in enumerate(final_links[:5]):
                print(f"  {i+1}. {link['url']} (from {link['sender']})")
        
        return final_links

    except Exception as e:
        print(f"Error extracting TikTok links: {e}")
        print("Please ensure you have granted Full Disk Access to your terminal for the iMessage database.")
        return []

if __name__ == "__main__":
    # Filter to only show TikToks from girlfriend
    # Based on the data, her phone number appears to be +14155176486
    girlfriend_number = "+14155176486"
    extract_rich_tiktok_links(days_back=60, from_sender=girlfriend_number) 