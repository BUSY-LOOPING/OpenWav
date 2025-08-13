import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import PlaylistCard from "./PlaylistCard";

export default function BillboardSection() {
  const navigate = useNavigate();
  const { accessToken } = useSelector((state: RootState) => state.auth);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

  
  const [playlists, setPlaylists] = useState({
    hot100: null,
    billboard200: null,
    radioSongs: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllCharts = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch each chart individually and handle failures separately
        const fetchChart = async (url: string, name: string) => {
          try {
            const response = await axios.get(url, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(`${name} response:`, response.data);
            return response.data.success ? response.data.playlist : null;
          } catch (error) {
            console.warn(`${name} not available:`, error);
            return null;
          }
        };
        
        const [hot100, billboard200, radioSongs] = await Promise.all([
          fetchChart(`${API_BASE_URL}/playlists/charts/hot-100/latest`, "Hot 100"),
          fetchChart(`${API_BASE_URL}/playlists/charts/billboard-200/latest`, "Billboard 200"),
          fetchChart(`${API_BASE_URL}/playlists/charts/radio-songs/latest`, "Radio Songs")
        ]);

        setPlaylists({
          hot100,
          billboard200,
          radioSongs
        });

      } catch (error) {
        console.error("Unexpected error in fetchAllCharts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCharts();
  }, [accessToken]);

  const handlePlaylistClick = (playlist: any) => {
    navigate(`/playlist/${playlist.id}`);
  };

  const handlePlay = (playlist: any) => {
    console.log("Playing playlist:", playlist.name);
  };

  const handleLike = (playlist: any) => {
    console.log("Liked playlist:", playlist.name);
  };

  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Billboard Charts</h2>
            <p className="text-gray-400 text-sm">This week's hottest music</p>
          </div>
        </div>
        <div className="flex justify-center items-center p-8">
          <div className="text-gray-400">Loading Billboard charts...</div>
        </div>
      </section>
    );
  }

  const hasAnyData = playlists.hot100 || playlists.billboard200 || playlists.radioSongs;

  if (!hasAnyData) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Billboard Charts</h2>
            <p className="text-gray-400 text-sm">This week's hottest music</p>
          </div>
        </div>
        <div className="text-gray-400 text-center p-8">
          Billboard charts unavailable
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Billboard Charts</h2>
          <p className="text-gray-400 text-sm">This week's hottest music</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.hot100 && (
          <PlaylistCard
            playlist={playlists.hot100}
            onPlay={handlePlay}
            onLike={handleLike}
            onClick={handlePlaylistClick}
          />
        )}

        {playlists.billboard200 && (
          <PlaylistCard
            playlist={playlists.billboard200}
            onPlay={handlePlay}
            onLike={handleLike}
            onClick={handlePlaylistClick}
          />
        )}

        {playlists.radioSongs && (
          <PlaylistCard
            playlist={playlists.radioSongs}
            onPlay={handlePlay}
            onLike={handleLike}
            onClick={handlePlaylistClick}
          />
        )}
      </div>
      
      
    </section>
  );
}
