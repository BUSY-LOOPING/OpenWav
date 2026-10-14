import pytest

from app import normalize


@pytest.mark.parametrize(
    "value,expected",
    [("3:45", 225), ("1:02:03", 3723), ("45", 45), (225.7, 225), (180, 180), ("", None), ("3:4x", None), (None, None), (-1, None), (True, None), ("1:2:3:4", None)],
)
def test_parse_duration(value, expected):
    assert normalize.parse_duration(value) == expected


def test_largest_thumbnail_picks_biggest_area():
    thumbs = [{"url": "s", "width": 60, "height": 60}, {"url": "l", "width": 544, "height": 544}, {"url": "m", "width": 226, "height": 226}]
    assert normalize.largest_thumbnail(thumbs) == "l"


def test_largest_thumbnail_handles_missing_and_bad_input():
    assert normalize.largest_thumbnail(None) is None
    assert normalize.largest_thumbnail([{"width": 10}]) is None
    assert normalize.largest_thumbnail([{"url": "only"}]) == "only"


def test_from_ytmusic_song():
    item = normalize.from_ytmusic(
        {
            "resultType": "song",
            "videoId": "abc123",
            "title": "Song",
            "artists": [{"name": "Artist A", "id": "1"}, {"name": "Artist B"}],
            "album": {"name": "Album", "id": "2"},
            "duration": "3:45",
            "thumbnails": [{"url": "small", "width": 60, "height": 60}, {"url": "big", "width": 120, "height": 120}],
        }
    )
    assert item == {
        "videoId": "abc123",
        "url": "https://www.youtube.com/watch?v=abc123",
        "title": "Song",
        "channel": "Artist A",
        "artists": ["Artist A", "Artist B"],
        "album": "Album",
        "thumbnailUrl": "big",
        "durationSec": 225,
        "type": "song",
        "views": None,
    }


def test_from_ytmusic_prefers_duration_seconds_and_skips_invalid():
    assert normalize.from_ytmusic({"videoId": "x", "title": "t", "duration_seconds": 10, "duration": "9:99"})["durationSec"] == 10
    assert normalize.from_ytmusic({"title": "no id"}) is None
    assert normalize.from_ytmusic("nope") is None
    assert normalize.from_ytmusic({"videoId": "x", "title": "t"})["album"] is None


def test_from_ytdlp_search():
    payload = {
        "entries": [
            {"id": "v1", "title": "First", "channel": "Chan", "duration": 200.0, "thumbnails": [{"url": "t1", "width": 1, "height": 1}]},
            {"id": "v2", "title": "Second", "uploader": "Up"},
            {"title": "missing id"},
        ]
    }
    items = normalize.from_ytdlp_search(payload)
    assert [i["videoId"] for i in items] == ["v1", "v2"]
    assert items[0]["channel"] == "Chan"
    assert items[0]["durationSec"] == 200
    assert items[1]["channel"] == "Up"
    assert items[1]["thumbnailUrl"] == "https://i.ytimg.com/vi/v2/hqdefault.jpg"
    assert normalize.from_ytdlp_search({}) == []
    assert normalize.from_ytdlp_search(None) == []


@pytest.mark.parametrize(
    "charts",
    [
        {"songs": {"items": [{"videoId": "a", "title": "A"}]}},
        {"videos": [{"playlistId": "PL"}], "trending": {"items": [{"videoId": "a", "title": "A"}]}},
        {"videos": {"items": [{"videoId": "a", "title": "A"}]}},
    ],
)
def test_chart_items_tolerates_shapes(charts):
    assert [i["videoId"] for i in normalize.chart_items(charts)] == ["a"]


def test_chart_items_empty_on_unknown_shape():
    assert normalize.chart_items({"artists": []}) == []
    assert normalize.chart_items(None) == []


def test_artist_match_skips_bad_rows_and_falls_back_to_first():
    from app.normalize import artist_match
    rows = [None, {"artist": "X"}, {"artists": [{"name": "Nucleya"}], "browseId": "UC9", "thumbnails": [{"url": "u", "width": 1, "height": 1}]}]
    assert artist_match(rows, "someone else")["name"] == "Nucleya"
    assert artist_match([], "x") is None


def test_collections_build_importable_urls_and_upsize_art():
    from app.normalize import from_collection, from_ytmusic
    album = {"browseId": "MPRE1", "playlistId": "OLAK1", "title": "Prism", "type": "Album", "year": "2013", "artists": [{"name": "Katy Perry"}], "thumbnails": [{"url": "https://yt3.googleusercontent.com/x=w60-h60-l90-rj", "width": 60, "height": 60}]}
    playlist = {"browseId": "VLPL123", "title": "Mix", "author": "Me", "itemCount": 65, "thumbnails": []}
    assert from_collection([album, {"title": "no id"}], "albums") == [{
        "type": "album", "browseId": "MPRE1", "playlistId": "OLAK1", "title": "Prism", "artists": ["Katy Perry"], "year": "2013", "albumType": "Album",
        "thumbnailUrl": "https://yt3.googleusercontent.com/x=w544-h544-l90-rj", "url": "https://music.youtube.com/playlist?list=OLAK1",
    }]
    assert from_collection([playlist], "playlists")[0] == {"type": "playlist", "playlistId": "PL123", "title": "Mix", "author": "Me", "itemCount": "65", "thumbnailUrl": None, "url": "https://www.youtube.com/playlist?list=PL123"}
    video = from_ytmusic({"resultType": "video", "videoId": "v1", "title": "T", "views": "4.2B"})
    assert (video["type"], video["views"], video["thumbnailUrl"]) == ("video", "4.2B", "https://i.ytimg.com/vi/v1/hqdefault.jpg")
