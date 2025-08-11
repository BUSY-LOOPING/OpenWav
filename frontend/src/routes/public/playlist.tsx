import PlaylistHeader from "../../components/PlaylistHeader";
import TrackList from "../../components/TrackList";
import { playlistData } from "../../data/playlistData";

export default function Playlist() {
  return (
    <main className="w-full bg-gray-900 min-h-screen flex flex-row">
      <PlaylistHeader playlist={playlistData} />
      <div className="p-6">
        <TrackList tracks={playlistData.tracks} />
      </div>
    </main>
  );
}
