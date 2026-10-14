# Auto-discovery, cookies and artist images

## Auto-discovery

The scheduler checks every minute and, every `discovery.interval_hours` (default 24), asks the scraper for top tracks from the charts, each configured genre, your library's most-played artists and the configured "picks" queries. It also imports any configured playlist URLs. Tracks already in the library or already queued are skipped. Downloads are owned by the first active admin. **Admin → Auto-discovery** shows each source and the live status of every download from the last run, and **Run now** triggers a run within a minute. Tune or disable it under **Admin → Settings → Auto-discovery**.

## YouTube cookies

If downloads fail with `Sign in to confirm you're not a bot` or `HTTP Error 403`, upload a `cookies.txt` under **Admin → Settings → YouTube cookies**. Only youtube.com and google.com cookies are stored, and the API never returns them. The downloader writes them to a private temp file for each yt-dlp run and deletes it afterwards. An uploaded file takes precedence over `YTDLP_COOKIES_FILE`. To export on macOS:

```bash
yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download "https://www.youtube.com/watch?v=jNQXAC9IVRw"
```

## Artist images

The downloader creates artists without photos. Every 5 minutes, the scheduler's `enrichArtists` job takes up to 25 artists with no `image_url` and asks the scraper's `/artist?q=` endpoint, which searches YouTube Music artists, prefers an exact name match and returns a 544 px photo. If no photo is found, the artist isn't checked again for 7 days. If the scraper is unreachable, the job retries on its next run.
