import sqlite3
import json
import os
import datetime
import re
from nska_deserialize import deserialize_plist_from_string

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

def find_urls_in_object(obj, url_regex, found_urls):
    """Recursively searches for URLs in a deserialized object."""
    if isinstance(obj, str):
        matches = url_regex.findall(obj)
        for match in matches:
            found_urls.add(match.split(' ')[0]) # Take only the URL part
    elif isinstance(obj, dict):
        for key, value in obj.items():
            find_urls_in_object(value, url_regex, found_urls)
    elif isinstance(obj, list):
        for item in obj:
            find_urls_in_object(item, url_regex, found_urls)

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
                message.date DESC
            LIMIT 50;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        # Regex for TikTok URLs, including vm.tiktok.com and m.tiktok.com
        url_regex = re.compile(r'(?:https?://)?(?:www\.)?(?:m\.)?(?:tiktok\.com|vm\.tiktok\.com)/[^\s]+')

        print('--- Debugging attributedBody and text content ---')
        for row in rows:
            text_content, mac_time, sender, attributed_body_blob = row
            
            timestamp = mac_time_to_datetime(mac_time)
            if not timestamp:
                continue

            print(f"\n--- Message (Date: {timestamp.isoformat()}, Sender: {sender}) ---")
            print(f"Text Content: {text_content}")

            if attributed_body_blob:
                print(f"attributedBody Type: {type(attributed_body_blob)}")
                print(f"attributedBody Length: {len(attributed_body_blob)} bytes")
                print(f"attributedBody First 50 bytes: {attributed_body_blob[:50]}")
                try:
                    deserialized_obj = deserialize_plist_from_string(attributed_body_blob)
                    print(f"Deserialized attributedBody: {deserialized_obj}")
                except Exception as e:
                    print(f"Could not deserialize attributedBody: {e}")
            else:
                print("attributedBody: None")
        print('---------------------------------------------------')

    except Exception as e:
        print(f"Error extracting TikTok links: {e}")
        print("Please ensure you have granted Full Disk Access to your terminal for the iMessage database.")

if __name__ == "__main__":
    extract_rich_tiktok_links(days_back=30)