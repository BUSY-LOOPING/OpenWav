import asyncio
import json
import random
import re
from typing import Any, Callable, Dict, List, Optional

from prometheus_client import Counter

from . import normalize

upstream_errors = Counter("scraper_upstream_errors_total", "Upstream scrape failures", ["source"])

RETRYABLE = re.compile(r"\b(429|5\d\d)\b")


class UpstreamError(Exception):
    pass


def radio_tracks(client: Any, video_id: str) -> List[Dict[str, Any]]:
    try:
        return client.get_watch_playlist(videoId=video_id, limit=25)["tracks"]
    except KeyError:
        from ytmusicapi.navigation import TAB_CONTENT, nav
        from ytmusicapi.parsers.watch import parse_watch_playlist

        body = {
            "enablePersistentPlaylistPanel": True,
            "isAudioOnly": True,
            "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
            "videoId": video_id,
            "playlistId": f"RDAMVM{video_id}",
        }
        response = client._send_request("next", body)
        renderer = nav(response, ["contents", "singleColumnMusicWatchNextResultsRenderer", "tabbedRenderer", "watchNextTabbedResultsRenderer"], True)
        results = nav(renderer, [*TAB_CONTENT, "musicQueueRenderer", "content", "playlistPanelRenderer"], True) if renderer else None
        return parse_watch_playlist(results["contents"]) if results else []


def is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, asyncio.TimeoutError) or bool(RETRYABLE.search(str(exc)))


class Upstream:
    def __init__(self, timeout: float, concurrency: int, ytmusic_factory: Callable[[], Any] = None, ytdlp_bin: str = "yt-dlp", retries: int = 2, backoff: float = 0.5):
        self.timeout = timeout
        self.concurrency = concurrency
        self._semaphore = None
        self.ytmusic_factory = ytmusic_factory or self._default_ytmusic
        self.ytdlp_bin = ytdlp_bin
        self.retries = retries
        self.backoff = backoff
        self._ytmusic = None

    @staticmethod
    def _default_ytmusic():
        from ytmusicapi import YTMusic

        return YTMusic()

    @property
    def semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.concurrency)
        return self._semaphore

    def _client(self):
        if self._ytmusic is None:
            self._ytmusic = self.ytmusic_factory()
        return self._ytmusic

    def _invoke(self, method: Any, args, kwargs):
        try:
            client = self._client()
            return method(client, *args, **kwargs) if callable(method) else getattr(client, method)(*args, **kwargs)
        except StopIteration as exc:
            raise UpstreamError(f"{method} returned an unexpected page shape") from exc

    async def _ytmusic_call(self, method: Any, *args, **kwargs):
        attempt = 0
        while True:
            try:
                async with self.semaphore:
                    return await asyncio.wait_for(asyncio.to_thread(self._invoke, method, args, kwargs), self.timeout)
            except Exception as exc:
                if attempt >= self.retries or not is_retryable(exc):
                    upstream_errors.labels("ytmusic").inc()
                    raise UpstreamError(str(exc)) from exc
                attempt += 1
                await asyncio.sleep(self.backoff * (2 ** attempt) * (0.5 + random.random()))

    async def _ytdlp_search(self, q: str, limit: int) -> List[Dict[str, Any]]:
        async with self.semaphore:
            proc = await asyncio.create_subprocess_exec(
                self.ytdlp_bin, "--flat-playlist", "-J", "--no-warnings", f"ytsearch{limit}:{q}",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), self.timeout)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                upstream_errors.labels("ytdlp").inc()
                raise UpstreamError("yt-dlp timed out")
        if proc.returncode != 0:
            upstream_errors.labels("ytdlp").inc()
            raise UpstreamError(stderr.decode(errors="replace")[-300:] or f"yt-dlp exited {proc.returncode}")
        try:
            return normalize.from_ytdlp_search(json.loads(stdout))
        except ValueError as exc:
            upstream_errors.labels("ytdlp").inc()
            raise UpstreamError("yt-dlp returned invalid JSON") from exc

    async def search(self, q: str, limit: int, filter: str) -> List[Dict[str, Any]]:
        if filter in normalize.COLLECTIONS:
            return normalize.from_collection(await self._ytmusic_call("search", q, filter=filter, limit=limit), filter)[:limit]
        try:
            results = await self._ytmusic_call("search", q, filter=filter, limit=limit)
            items = normalize.from_ytmusic_results(results)
            if items:
                return items[:limit]
        except UpstreamError:
            pass
        return (await self._ytdlp_search(q, limit))[:limit]

    async def artist(self, name: str) -> Optional[Dict[str, Any]]:
        return normalize.artist_match(await self._ytmusic_call("search", name, filter="artists", limit=5), name)

    async def related(self, video_id: str) -> List[Dict[str, Any]]:
        return normalize.from_watch(await self._ytmusic_call(radio_tracks, video_id), video_id)

    async def suggestions(self, q: str) -> List[str]:
        results = await self._ytmusic_call("get_search_suggestions", q)
        return [r for r in results or [] if isinstance(r, str)]

    async def charts(self, country: str) -> List[Dict[str, Any]]:
        try:
            return normalize.chart_items(await self._ytmusic_call("get_charts", country=country))
        except UpstreamError:
            return []
