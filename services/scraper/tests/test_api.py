import asyncio
import json
import stat
import sys

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.upstream import Upstream, UpstreamError, is_retryable

SONG = {"videoId": "abc", "title": "Song", "artists": [{"name": "Artist"}], "album": {"name": "Album"}, "duration": "3:00", "thumbnails": [{"url": "t", "width": 1, "height": 1}]}


class FakeYTMusic:
    def __init__(self, search=None, error=None, charts=None):
        self.calls = []
        self._search = search if search is not None else [SONG]
        self._error = error
        self._charts = charts if charts is not None else {"songs": {"items": [SONG]}}

    def search(self, q, filter=None, limit=None):
        self.calls.append(("search", q, filter, limit))
        if self._error:
            raise self._error
        if filter == "artists":
            return [
                {"artist": "Taylor Swift Tribute", "browseId": "UC2", "thumbnails": [{"url": "https://lh3.googleusercontent.com/b=w120-h120-l90", "width": 120, "height": 120}]},
                {"artist": "Taylor Swift", "browseId": "UC1", "thumbnails": [{"url": "https://lh3.googleusercontent.com/a=w60-h60-l90", "width": 60, "height": 60}]},
            ]
        return self._search

    def get_search_suggestions(self, q):
        self.calls.append(("suggest", q))
        return ["one", "two", {"not": "a string"}]

    def get_charts(self, country=None):
        self.calls.append(("charts", country))
        if self._error:
            raise self._error
        return self._charts


class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value


def fake_ytdlp(tmp_path, payload, exit_code=0):
    script = tmp_path / "yt-dlp"
    script.write_text(f"#!{sys.executable}\nimport json, sys\nprint(json.dumps({payload!r}))\nsys.stderr.write(repr(sys.argv[1:]))\nsys.exit({exit_code})\n")
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return str(script)


def client_for(yt, ytdlp_bin="yt-dlp-missing", redis=None):
    upstream = Upstream(timeout=5, concurrency=2, ytmusic_factory=lambda: yt, ytdlp_bin=ytdlp_bin, retries=1, backoff=0)
    return TestClient(create_app(upstream=upstream, redis=redis or FakeRedis()))


def test_search_returns_normalised_items_and_caches():
    yt = FakeYTMusic()
    client = client_for(yt)
    first = client.get("/search", params={"q": "  Song ", "limit": 5})
    second = client.get("/search", params={"q": "song", "limit": 5})
    assert first.status_code == 200
    assert first.json()["items"][0] == {
        "videoId": "abc",
        "url": "https://www.youtube.com/watch?v=abc",
        "title": "Song",
        "channel": "Artist",
        "artists": ["Artist"],
        "album": "Album",
        "thumbnailUrl": "t",
        "durationSec": 180,
        "type": "song",
        "views": None,
    }
    assert second.json() == first.json()
    assert yt.calls == [("search", "Song", "songs", 5)]


def test_search_uses_redis_cache_across_instances():
    redis = FakeRedis()
    client_for(FakeYTMusic(), redis=redis).get("/search", params={"q": "x"})
    yt = FakeYTMusic()
    response = client_for(yt, redis=redis).get("/search", params={"q": "x"})
    assert response.json()["items"][0]["videoId"] == "abc"
    assert yt.calls == []


def test_search_falls_back_to_ytdlp(tmp_path):
    payload = {"entries": [{"id": "v1", "title": "From ytdlp", "channel": "Chan", "duration": 61}]}
    client = client_for(FakeYTMusic(error=RuntimeError("boom")), ytdlp_bin=fake_ytdlp(tmp_path, payload))
    response = client.get("/search", params={"q": "x", "filter": "videos"})
    assert response.status_code == 200
    assert response.json()["items"] == [
        {
            "videoId": "v1",
            "url": "https://www.youtube.com/watch?v=v1",
            "title": "From ytdlp",
            "channel": "Chan",
            "artists": [],
            "album": None,
            "thumbnailUrl": "https://i.ytimg.com/vi/v1/hqdefault.jpg",
            "durationSec": 61,
            "type": "song",
            "views": None,
        }
    ]


def test_search_returns_502_when_both_upstreams_fail(tmp_path):
    client = client_for(FakeYTMusic(error=RuntimeError("boom")), ytdlp_bin=fake_ytdlp(tmp_path, {}, exit_code=1))
    response = client.get("/search", params={"q": "x"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "UPSTREAM"


@pytest.mark.parametrize(
    "params",
    [{"q": ""}, {"q": "x" * 201}, {"q": "x", "limit": 0}, {"q": "x", "limit": 51}, {"q": "x", "filter": "podcasts"}, {}],
)
def test_search_validation(params):
    assert client_for(FakeYTMusic()).get("/search", params=params).status_code == 422


def test_suggestions_filters_non_strings():
    response = client_for(FakeYTMusic()).get("/suggestions", params={"q": "so"})
    assert response.json() == {"items": ["one", "two"]}


def test_charts_tolerates_failure_and_does_not_cache_empty():
    yt = FakeYTMusic(error=RuntimeError("bad shape"))
    client = client_for(yt)
    assert client.get("/charts").json() == {"items": []}
    client.get("/charts")
    assert len([c for c in yt.calls if c[0] == "charts"]) == 2


def test_charts_returns_items_and_validates_country():
    client = client_for(FakeYTMusic())
    assert client.get("/charts", params={"country": "us"}).json()["items"][0]["videoId"] == "abc"
    assert client.get("/charts", params={"country": "USA"}).status_code == 422


def test_health_and_metrics():
    client = client_for(FakeYTMusic())
    assert client.get("/health").json() == {"status": "ok"}
    client.get("/search", params={"q": "metrics"})
    body = client.get("/metrics").text
    assert 'http_request_duration_seconds_count{method="GET",route="/search",status="200"}' in body
    assert "scraper_cache_hits_total" in body
    assert "scraper_upstream_errors_total" in body


def test_retries_retryable_errors_then_succeeds():
    class Flaky(FakeYTMusic):
        def search(self, q, filter=None, limit=None):
            self.calls.append("search")
            if len(self.calls) == 1:
                raise RuntimeError("Server returned HTTP 429: Too Many Requests")
            return [SONG]

    yt = Flaky()
    upstream = Upstream(timeout=5, concurrency=1, ytmusic_factory=lambda: yt, retries=2, backoff=0)
    items = asyncio.run(upstream.search("x", 3, "songs"))
    assert items[0]["videoId"] == "abc"
    assert yt.calls == ["search", "search"]


def test_does_not_retry_client_errors():
    yt = FakeYTMusic(error=RuntimeError("HTTP 400 bad request"))
    upstream = Upstream(timeout=5, concurrency=1, ytmusic_factory=lambda: yt, retries=3, backoff=0)
    with pytest.raises(UpstreamError):
        asyncio.run(upstream._ytmusic_call("search", "x"))
    assert yt.calls == [("search", "x", None, None)]
    assert is_retryable(RuntimeError("503 Service Unavailable"))
    assert is_retryable(asyncio.TimeoutError())
    assert not is_retryable(RuntimeError("404 not found"))


def test_ytdlp_receives_argument_list_not_shell(tmp_path):
    marker = tmp_path / "args.json"
    script = tmp_path / "yt-dlp"
    script.write_text(f"#!{sys.executable}\nimport json, sys\nopen({str(marker)!r}, 'w').write(json.dumps(sys.argv[1:]))\nprint(json.dumps({{'entries': []}}))\n")
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    upstream = Upstream(timeout=5, concurrency=1, ytmusic_factory=lambda: FakeYTMusic(search=[]), ytdlp_bin=str(script), retries=0)
    assert asyncio.run(upstream.search("a; rm -rf /", 4, "songs")) == []
    assert json.loads(marker.read_text()) == ["--flat-playlist", "-J", "--no-warnings", "ytsearch4:a; rm -rf /"]


def test_stop_iteration_from_scraper_becomes_upstream_error():
    yt = FakeYTMusic(error=StopIteration())
    upstream = Upstream(timeout=5, concurrency=1, ytmusic_factory=lambda: yt, retries=0)
    assert asyncio.run(upstream.charts("US")) == []


def test_artist_prefers_exact_name_and_upsizes_thumbnail():
    yt = FakeYTMusic()
    body = client_for(yt).get("/artist", params={"q": "taylor swift"}).json()
    assert body["item"] == {"type": "artist", "name": "Taylor Swift", "browseId": "UC1", "thumbnailUrl": "https://lh3.googleusercontent.com/a=w544-h544-l90", "url": "https://music.youtube.com/channel/UC1"}
    assert yt.calls == [("search", "taylor swift", "artists", 5)]


def test_search_collections_without_ytdlp_fallback():
    yt = FakeYTMusic()
    client = client_for(yt)
    artists = client.get("/search", params={"q": "taylor", "filter": "artists"}).json()["items"]
    assert [a["name"] for a in artists] == ["Taylor Swift Tribute", "Taylor Swift"]
    assert client.get("/search", params={"q": "x", "filter": "podcasts"}).status_code == 422
