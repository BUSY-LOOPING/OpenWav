import re
from typing import Any, Dict, List, Optional


def parse_duration(value: Any) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value) if value >= 0 else None
    parts = str(value).strip().split(":")
    if not parts or not all(p.isdigit() for p in parts) or len(parts) > 3:
        return None
    seconds = 0
    for part in parts:
        seconds = seconds * 60 + int(part)
    return seconds


def largest_thumbnail(thumbnails: Any) -> Optional[str]:
    if not isinstance(thumbnails, list):
        return None
    candidates = [t for t in thumbnails if isinstance(t, dict) and t.get("url")]
    if not candidates:
        return None
    best = max(candidates, key=lambda t: (t.get("width") or 0) * (t.get("height") or 0))
    return best["url"]


def make_item(video_id: str, title: str, artists: List[str], channel: Optional[str], album: Optional[str], thumbnail: Optional[str], duration: Optional[int]) -> Dict[str, Any]:
    return {
        "videoId": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": title,
        "channel": artists[0] if artists else channel,
        "artists": artists,
        "album": album,
        "thumbnailUrl": thumbnail,
        "durationSec": duration,
        "type": "song",
        "views": None,
    }


def from_ytmusic(result: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(result, dict) or not result.get("videoId") or not result.get("title"):
        return None
    artists = [a["name"] for a in result.get("artists") or [] if isinstance(a, dict) and a.get("name")]
    album = result.get("album")
    duration = result.get("duration_seconds")
    if duration is None:
        duration = parse_duration(result.get("duration"))
    item = make_item(
        result["videoId"],
        result["title"],
        artists,
        None,
        album.get("name") if isinstance(album, dict) else None,
        upsize(largest_thumbnail(result.get("thumbnails"))) or f"https://i.ytimg.com/vi/{result['videoId']}/hqdefault.jpg",
        parse_duration(duration),
    )
    item["type"] = "video" if result.get("resultType") == "video" else "song"
    item["views"] = result.get("views")
    return item


def from_ytdlp_entry(entry: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(entry, dict) or not entry.get("id") or not entry.get("title"):
        return None
    channel = entry.get("channel") or entry.get("uploader")
    thumbnail = largest_thumbnail(entry.get("thumbnails"))
    if thumbnail is None:
        thumbnail = f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg"
    return make_item(entry["id"], entry["title"], [], channel, None, thumbnail, parse_duration(entry.get("duration")))


def from_ytdlp_search(payload: Any) -> List[Dict[str, Any]]:
    entries = payload.get("entries") if isinstance(payload, dict) else None
    return [item for item in (from_ytdlp_entry(e) for e in entries or []) if item]


def from_ytmusic_results(results: Any) -> List[Dict[str, Any]]:
    return [item for item in (from_ytmusic(r) for r in results or []) if item]


def chart_items(charts: Any) -> List[Dict[str, Any]]:
    if not isinstance(charts, dict):
        return []
    for key in ("songs", "videos", "trending"):
        section = charts.get(key)
        rows = section.get("items") if isinstance(section, dict) else section
        items = from_ytmusic_results(rows if isinstance(rows, list) else [])
        if items:
            return items
    return []


def upsize(url: Optional[str]) -> Optional[str]:
    return re.sub(r"=w\d+-h\d+", "=w544-h544", url) if url else url


def _names(result: Dict[str, Any]) -> List[str]:
    return [a["name"] for a in result.get("artists") or [] if isinstance(a, dict) and a.get("name")]


def from_album(result: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(result, dict) or not result.get("browseId") or not result.get("title"):
        return None
    playlist_id = result.get("playlistId")
    return {
        "type": "album",
        "browseId": result["browseId"],
        "playlistId": playlist_id,
        "title": result["title"],
        "artists": _names(result),
        "year": result.get("year"),
        "albumType": result.get("type"),
        "thumbnailUrl": upsize(largest_thumbnail(result.get("thumbnails"))),
        "url": f"https://music.youtube.com/playlist?list={playlist_id}" if playlist_id else None,
    }


def from_artist(result: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(result, dict) or not result.get("browseId"):
        return None
    name = result.get("artist") or next(iter(_names(result)), None)
    if not name:
        return None
    return {
        "type": "artist",
        "browseId": result["browseId"],
        "name": name,
        "thumbnailUrl": upsize(largest_thumbnail(result.get("thumbnails"))),
        "url": f"https://music.youtube.com/channel/{result['browseId']}",
    }


def from_playlist(result: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(result, dict) or not result.get("browseId") or not result.get("title"):
        return None
    playlist_id = result["browseId"][2:] if result["browseId"].startswith("VL") else result["browseId"]
    count = result.get("itemCount")
    return {
        "type": "playlist",
        "playlistId": playlist_id,
        "title": result["title"],
        "author": result.get("author"),
        "itemCount": str(count) if count is not None else None,
        "thumbnailUrl": largest_thumbnail(result.get("thumbnails")),
        "url": f"https://www.youtube.com/playlist?list={playlist_id}",
    }


COLLECTIONS = {"albums": from_album, "artists": from_artist, "playlists": from_playlist}


def from_collection(results: Any, kind: str) -> List[Dict[str, Any]]:
    return [item for item in (COLLECTIONS[kind](r) for r in results or []) if item]


def artist_match(results: Any, name: str) -> Optional[Dict[str, Any]]:
    artists = [a for a in from_collection(results, "artists") if a["thumbnailUrl"]]
    wanted = name.strip().casefold()
    return next((a for a in artists if a["name"].casefold() == wanted), artists[0] if artists else None)


def from_watch(tracks: Any, seed: str) -> List[Dict[str, Any]]:
    items = (
        from_ytmusic({**t, "resultType": "song", "duration": t.get("length"), "thumbnails": t.get("thumbnail") or t.get("thumbnails")})
        for t in tracks or []
        if isinstance(t, dict) and t.get("videoId") != seed
    )
    return [item for item in items if item]
