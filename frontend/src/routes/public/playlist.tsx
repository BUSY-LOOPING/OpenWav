import { useEffect, useState } from "react";
import { useParams } from "react-router";
import axios from "axios";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import PlaylistHeader from "../../components/PlaylistHeader";
import TrackList from "../../components/TrackList";
import { playlistData } from "../../data/playlistData"; // fallback only

export default function Playlist() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!id || !accessToken) {
        // No ID means we're not viewing a specific playlist, use fallback
        setPlaylist(playlistData);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const { data } = await axios.get(
          `http://localhost:3001/api/v1/playlists/${id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        
        if (data.success) {
          setPlaylist(data.playlist);
        } else {
          throw new Error(data.message || 'Failed to fetch playlist');
        }
      } catch (error: any) {
        console.error("Failed to fetch playlist:", error);
        setError(error.response?.data?.message || error.message || 'Failed to load playlist');
        // Use fallback data on error
        setPlaylist(playlistData);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [id, accessToken]);

  if (loading) {
    return (
      <main className="w-full bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading playlist...</div>
      </main>
    );
  }

  if (error && !playlist) {
    return (
      <main className="w-full bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-center">
          <p className="text-xl mb-2">Error loading playlist</p>
          <p className="text-sm">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full bg-gray-900 flex flex-row">
      <PlaylistHeader playlist={playlist} />
      <div className="p-6">
        <TrackList tracks={playlist.tracks} />
      </div>
    </main>
  );
}
