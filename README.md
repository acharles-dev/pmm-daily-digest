# PMM Daily Digest

Aggregates articles from 8 product marketing RSS feeds daily and serves a browsable archive on GitHub Pages.

**Live site:** [acharles-dev.github.io/pmm-daily-digest/](https://acharles-dev.github.io/pmm-daily-digest/)

## How it works

1. A GitHub Actions workflow runs daily at 1 PM UTC
2. A Python script fetches RSS feeds, deduplicates articles, and writes JSON to `data/`
3. GitHub Pages serves the static HTML archive from the repository

No API keys or external services needed.

## Sources

| Source | Feed |
|---|---|
| Product Marketing Alliance | productmarketingalliance.com/feed/ |
| Andrew Chen | andrewchen.com/feed/ |
| Intercom Blog | intercom.com/blog/feed/ |
| HubSpot Marketing | blog.hubspot.com/marketing/rss.xml |
| SaaStr | saastr.com/feed/ |
| Lenny's Newsletter | lennysnewsletter.com/feed |
| Growth Unhinged | growthunhinged.com/feed |
| ChartMogul | chartmogul.com/blog/feed/ |

## Run manually

Go to the **Actions** tab, select "Fetch PMM Articles", and click **Run workflow**.

Or run locally:

```bash
python scripts/fetch.py
```
