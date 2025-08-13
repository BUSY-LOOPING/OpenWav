import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
  const BACKEND_URL = import.meta.env.EXPRESS_BACKEND_URL || "http://localhost:3001";


  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delay = setTimeout(() => {
      fetchSearchResults(query);
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  const fetchSearchResults = async (searchTerm: string) => {
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/media/search?q=${encodeURIComponent(searchTerm)}&limit=5`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (data.success) {
        const allItems = [
          ...(data.data.results.local || []),
          ...(data.data.results.youtube || []),
        ];

        const sorted = [...allItems].sort((a, b) => {
          const aDownloaded = a.isDownloaded || a.source === "local" || a.canPlay;
          const bDownloaded = b.isDownloaded || b.source === "local" || b.canPlay;
          return bDownloaded ? 1 : aDownloaded ? -1 : 0;
        });

        setResults(sorted.slice(0, 5));
        setShowDropdown(true);
      }
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    }
  };

  const getArtistNames = (artists: any[]) => {
    if (!artists || artists.length === 0) return "";
    return artists.map((artist) => artist.name).join(", ");
  };

  const getThumbnailUrl = (item: any) => {
    if (item.source === "local") {
      return item.thumbnail_path.startsWith("http")
        ? item.thumbnail_path
        : `${BACKEND_URL}/${item.thumbnail_path}`;
    }
    return item.thumbnail_path;
  };

  return (
    <div className="relative w-full">
      <div
        className="flex items-center rounded-full px-3 py-2"
        style={{ backgroundColor: "#242424" }}
      >
        <span className="material-icons text-gray-400">search</span>
        <input
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              navigate(`/search?q=${encodeURIComponent(query)}`);
              setShowDropdown(false);
            }
          }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="w-full pl-2 bg-transparent border-none focus:outline-none text-white"
          placeholder="Search"
          type="text"
        />
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute w-full mt-1 bg-gray-800 rounded-md shadow-lg z-50">
          {results.map((item) => (
            <div
              key={item.id}
              className="flex items-center space-x-3 p-2 hover:bg-gray-700 cursor-pointer"
              onClick={() => {
                navigate(`/search?q=${encodeURIComponent(query)}`);
                setShowDropdown(false);
              }}
              title={`${item.title} - ${getArtistNames(item.artists)}`}
            >
              {item.thumbnail_path && (
                <img
                  src={getThumbnailUrl(item)}
                  alt={item.title}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{item.title}</div>
                <div className="text-xs text-gray-400">
                  {item.source}{" "}
                  {getArtistNames(item.artists) ? `— ${getArtistNames(item.artists)}` : ""}
                  {item.isDownloaded ? " • Downloaded" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
