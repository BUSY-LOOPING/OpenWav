import { useState, useEffect } from "react";
import TrackCard from "./TrackCard";
import Section from "./Section";
import { apiService } from "../services/api";
import { convertMediaArrayToTracks } from "../utils/mediaConverter";
import type { Track } from "../index";

export default function DiscoverSection() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getMediaList({ limit: 6 });
      
      if (response.success) {
        const convertedTracks = convertMediaArrayToTracks(response.data.media);
        setTracks(convertedTracks);
        
      } else {
        setError("Failed to load media");
      }
    } catch (err) {
      console.error("Error loading media:", err);
      setError("Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
    console.log("Playing:", track);
  };

  const handleLike = (track: Track) => {
    console.log("Liked:", track);
  };

  const handleAddToPlaylist = (track: Track) => {
    console.log("Adding to playlist:", track);
  };

  if (loading) {
    return (
      <Section title="Discover" subtitle="Fresh content for you">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-gray-700 h-48 rounded-md mb-4"></div>
            <div className="bg-gray-700 h-4 rounded mb-2"></div>
            <div className="bg-gray-700 h-3 rounded w-3/4"></div>
          </div>
        ))}
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Discover" subtitle="Fresh content for you" onRefresh={loadMedia}>
        <div className="col-span-full">
          <div className="p-6 rounded-lg text-center">
            <p className="text-gray-400 mb-4">{error}</p>
            <button 
              onClick={loadMedia}
              className="bg-gray-800 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-semibold"
            >
              Try Again
            </button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section 
      title="Discover" 
      subtitle="Fresh content for you" 
      onRefresh={loadMedia}
    >
      {tracks.length > 0 ? (
        tracks.map((track) => (
          <TrackCard 
            key={track.id} 
            track={track}
            onPlay={handlePlay}
            onLike={handleLike}
            onAddToPlaylist={handleAddToPlaylist}
          />
        ))
      ) : (
        <div className="col-span-full">
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <p className="text-gray-400">No media found</p>
          </div>
        </div>
      )}
    </Section>
  );
}
