import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";

export default function SearchPage() {
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const location = useLocation();
  const searchQuery = new URLSearchParams(location.search).get("q") || "";

  useEffect(() => {
    if (searchQuery.trim()) {
      fetchResults();
    }
  }, [searchQuery]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `http://localhost:3001/api/v1/media/search?q=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (data.success) {
        setLocalResults(data.data.results.local || []);
        setYoutubeResults(data.data.results.youtube || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getArtistNames = (artists: any[]) =>
    artists?.length ? artists.map((a) => a.name).join(", ") : "";

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getThumbnailUrl = (item: any) => {
    if (item.source === "local") {
      return item.thumbnail_path?.startsWith("http")
        ? item.thumbnail_path
        : `http://localhost:3001/${item.thumbnail_path}`;
    }
    return item.thumbnail_path;
  };

  const renderItem = (item: any) => (
    <div
      key={item.id}
      className="flex items-center justify-between p-3 hover:bg-gray-800 rounded relative"
    >
      <div className="flex items-center space-x-3">
        <img
          src={getThumbnailUrl(item)}
          alt={item.title}
          className="w-14 h-14 rounded object-cover"
        />
        <div>
          <div className="text-white font-medium">{item.title}</div>
          <div className="text-gray-400 text-sm">
            {getArtistNames(item.artists)}
            {item.duration ? ` • ${formatDuration(item.duration)}` : ""}
          </div>
        </div>
      </div>

      {/* Three dots menu toggle */}
      <button
        className="text-gray-400 hover:text-white px-2"
        onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
      >
        <span className="material-icons">more_vert</span>
      </button>

      {/* Dropdown menu */}
      {openMenuId === item.id && (
        <div className="absolute right-2 top-12 bg-gray-900 border border-gray-700 rounded shadow-lg z-50 w-40">
          <button
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={() => console.log("Play", item)}
          >
            ▶ Play
          </button>
          {item.source === "youtube" && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
              onClick={() => console.log("Download", item)}
            >
              ⬇ Download
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
            onClick={() => console.log("Add to Playlist", item)}
          >
            ➕ Add to Playlist
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">
        Search results for "{searchQuery}"
      </h1>

      {loading && <div>Loading...</div>}

      {!loading && (
        <>
          {localResults.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Local</h2>
              <div className="bg-gray-900 rounded">
                {localResults.map(renderItem)}
              </div>
            </section>
          )}

          {youtubeResults.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-2">YouTube</h2>
              <div className="bg-gray-900 rounded">
                {youtubeResults.map(renderItem)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
