# TikTok Link Extraction - Duplicate Issue Fix

## Problem
The original TikTok link extraction script was generating massive duplicates (from 20 unique URLs to 2,982 entries) with corrupted URLs like:
- `https://www.tiktok.com/t/ZP8hC4xcr/��iI#����`
- `https://www.tiktok.com/t/ZP8hC4xcr/������__kIMMessagePartAttributeName...`
- Very long URLs with binary data appended

## Root Cause
1. **Failed deserialization**: The `NSKeyedUnArchiver` library couldn't properly deserialize the iMessage `attributedBody` BLOBs (all failed with "Invalid file")
2. **Raw binary extraction**: The original code was finding TikTok URLs in raw binary data but not cleaning them properly
3. **Multiple extraction sources**: Same URL was being found in different parts of the binary data structure, creating duplicates
4. **Poor regex termination**: The regex pattern `[^\s]+` didn't properly terminate URLs in binary data

## Solution
Created `extract_rich_tiktok_links_fixed.py` with these improvements:

### 1. **Proper Binary Data Handling**
```python
def extract_urls_from_binary(binary_data):
    # Convert binary to UTF-8 string, ignoring errors
    text_data = binary_data.decode('utf-8', errors='ignore')
    # Extract URLs with proper cleaning
```

### 2. **Robust URL Cleaning**
```python
def clean_and_normalize_tiktok_url(url):
    # Remove control characters: re.sub(r'[^\x20-\x7E]', '', str(url))
    # Multiple regex patterns for different TikTok URL formats
    # Normalize domains (vm.tiktok.com → www.tiktok.com)
    # Ensure consistent trailing slash
```

### 3. **Smart Deduplication**
- Uses dictionary keyed by clean URL
- Keeps only the most recent timestamp for each URL
- Processes URLs from both text content and binary data

### 4. **Better Error Handling**
- Gracefully handles binary data that can't be decoded
- Continues processing even if individual messages fail
- No crashes from malformed data

## Results
- **Before**: 2,982 entries with corrupted duplicates
- **After**: 20 unique, clean TikTok links
- **Performance**: Processes 1,718 messages efficiently
- **Data Quality**: All URLs are properly formatted and deduplicated

## Usage
```bash
source venv/bin/activate
python3 extract_rich_tiktok_links_fixed.py
```

The script now properly extracts TikTok links from iMessage without duplicates or corruption, giving you exactly what you need for your messages viewer application. 