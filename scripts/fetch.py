#!/usr/bin/env python3
"""Fetch articles from PMM RSS feeds and update data/articles.json."""

import hashlib
import html
import json
import os
import re
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

SOURCES = {
    "pma": {
        "name": "Product Marketing Alliance",
        "url": "https://www.productmarketingalliance.com/feed/",
    },
    "andrew_chen": {
        "name": "Andrew Chen",
        "url": "https://andrewchen.com/feed/",
    },
    "intercom": {
        "name": "Intercom Blog",
        "url": "https://www.intercom.com/blog/feed/",
    },
    "hubspot": {
        "name": "HubSpot Marketing",
        "url": "https://blog.hubspot.com/marketing/rss.xml",
    },
    "saastr": {
        "name": "SaaStr",
        "url": "https://www.saastr.com/feed/",
    },
    "lenny": {
        "name": "Lenny's Newsletter",
        "url": "https://www.lennysnewsletter.com/feed",
    },
    "growth_unhinged": {
        "name": "Growth Unhinged",
        "url": "https://www.growthunhinged.com/feed",
    },
    "chartmogul": {
        "name": "ChartMogul",
        "url": "https://chartmogul.com/blog/feed/",
    },
}

MAX_ARTICLES = 500
SUMMARY_LENGTH = 200
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = 30

# Repo root is one level up from scripts/
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


def strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def truncate(text: str, length: int = SUMMARY_LENGTH) -> str:
    text = strip_html(text)
    if len(text) <= length:
        return text
    return text[:length].rsplit(" ", 1)[0] + "..."


def parse_date(date_str: str) -> str:
    """Parse various RSS/Atom date formats into YYYY-MM-DD."""
    if not date_str:
        return ""

    date_str = date_str.strip()

    # Try RFC 2822 (standard RSS pubDate)
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    # Try ISO 8601 (Atom feeds)
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            # Handle timezone offset without colon (e.g. +0000)
            cleaned = re.sub(r"(\d{2}):(\d{2})$", r"\1\2", date_str)
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try with fractional seconds
    try:
        cleaned = re.sub(r"\.\d+", "", date_str)
        cleaned = re.sub(r"(\d{2}):(\d{2})$", r"\1\2", cleaned)
        dt = datetime.strptime(cleaned, "%Y-%m-%dT%H:%M:%S%z")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return ""


def fetch_url(url: str) -> bytes:
    """Fetch URL content with browser-like headers and redirect following."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def parse_rss_items(root: ET.Element) -> list:
    """Parse RSS 2.0 items from <channel><item> elements."""
    items = []
    for item in root.iter("item"):
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        description = item.findtext("description", "")
        pub_date = item.findtext("pubDate", "")
        if title and link:
            items.append({
                "title": title,
                "url": link,
                "description": description,
                "date_raw": pub_date,
            })
    return items


def parse_atom_entries(root: ET.Element) -> list:
    """Parse Atom feed entries."""
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = []

    # Try with namespace first, then without
    entries = root.findall(".//atom:entry", ns)
    if not entries:
        entries = root.findall(".//{http://www.w3.org/2005/Atom}entry")
    if not entries:
        entries = root.findall(".//entry")

    for entry in entries:
        # Title
        title_el = (
            entry.find("atom:title", ns)
            or entry.find("{http://www.w3.org/2005/Atom}title")
            or entry.find("title")
        )
        title = (title_el.text or "").strip() if title_el is not None else ""

        # Link
        link = ""
        for link_el in (
            entry.findall("atom:link", ns)
            + entry.findall("{http://www.w3.org/2005/Atom}link")
            + entry.findall("link")
        ):
            href = link_el.get("href", "")
            rel = link_el.get("rel", "alternate")
            if href and rel == "alternate":
                link = href
                break
            if href and not link:
                link = href

        # Summary / content
        summary_el = (
            entry.find("atom:summary", ns)
            or entry.find("{http://www.w3.org/2005/Atom}summary")
            or entry.find("summary")
            or entry.find("atom:content", ns)
            or entry.find("{http://www.w3.org/2005/Atom}content")
            or entry.find("content")
        )
        description = (summary_el.text or "") if summary_el is not None else ""

        # Date
        date_el = (
            entry.find("atom:published", ns)
            or entry.find("{http://www.w3.org/2005/Atom}published")
            or entry.find("published")
            or entry.find("atom:updated", ns)
            or entry.find("{http://www.w3.org/2005/Atom}updated")
            or entry.find("updated")
        )
        date_raw = (date_el.text or "") if date_el is not None else ""

        if title and link:
            items.append({
                "title": title,
                "url": link,
                "description": description,
                "date_raw": date_raw,
            })

    return items


def parse_feed(xml_bytes: bytes) -> list:
    """Detect feed type and parse items."""
    root = ET.fromstring(xml_bytes)
    tag = root.tag.lower().split("}")[-1] if "}" in root.tag else root.tag.lower()

    if tag == "rss" or root.find("channel") is not None:
        return parse_rss_items(root)
    elif tag == "feed" or "atom" in root.tag.lower():
        return parse_atom_entries(root)
    else:
        # Try both
        items = parse_rss_items(root)
        if not items:
            items = parse_atom_entries(root)
        return items


def fetch_source(key: str, source: dict) -> tuple:
    """Fetch and parse a single source. Returns (articles, error_msg)."""
    try:
        xml_bytes = fetch_url(source["url"])
        raw_items = parse_feed(xml_bytes)

        articles = []
        for item in raw_items:
            articles.append({
                "title": strip_html(item["title"]),
                "url": item["url"],
                "source": key,
                "source_name": source["name"],
                "date": parse_date(item["date_raw"]),
                "summary": truncate(item["description"]),
            })

        return articles, None

    except urllib.error.HTTPError as e:
        return [], f"{e.code} {e.reason}"
    except urllib.error.URLError as e:
        return [], str(e.reason)
    except ET.ParseError as e:
        return [], f"XML parse error: {e}"
    except Exception as e:
        return [], str(e)


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    articles_path = DATA_DIR / "articles.json"
    status_path = DATA_DIR / "status.json"

    # Load existing articles
    existing = []
    if articles_path.exists():
        try:
            existing = json.loads(articles_path.read_text())
        except (json.JSONDecodeError, OSError):
            existing = []

    # Build set of existing URL hashes for dedup
    seen_hashes = {url_hash(a["url"]) for a in existing}

    # Fetch all sources
    new_articles = []
    source_status = {}

    for key, source in SOURCES.items():
        print(f"Fetching {source['name']}...", flush=True)
        articles, error = fetch_source(key, source)

        if error:
            print(f"  ERROR: {error}")
            source_status[key] = {
                "status": "error",
                "name": source["name"],
                "error": error,
            }
        else:
            added = 0
            for article in articles:
                h = url_hash(article["url"])
                if h not in seen_hashes:
                    seen_hashes.add(h)
                    new_articles.append(article)
                    added += 1
            print(f"  Found {len(articles)} articles, {added} new")
            source_status[key] = {
                "status": "ok",
                "name": source["name"],
                "articles_found": len(articles),
            }

    # Merge and sort
    all_articles = existing + new_articles
    all_articles.sort(key=lambda a: a.get("date", "") or "", reverse=True)

    # Trim to max
    all_articles = all_articles[:MAX_ARTICLES]

    # Write articles
    articles_path.write_text(json.dumps(all_articles, indent=2, ensure_ascii=False))

    # Write status
    status = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_articles": len(all_articles),
        "sources": source_status,
    }
    status_path.write_text(json.dumps(status, indent=2, ensure_ascii=False))

    print(f"\nDone. {len(new_articles)} new articles added, {len(all_articles)} total.")


if __name__ == "__main__":
    main()
