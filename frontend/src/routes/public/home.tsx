import TopBar from "../../components/TopBar";
import CategoryChips from "../../components/CategoryChips";
import Section from "../../components/Section";
import DiscoverSection from "../../components/DiscoverSection";
import TrackCard from "../../components/TrackCard";
import { listenAgainTracks, forgottenFavorites, categories, user } from "../../data/mockData";

export default function Home() {
  const handlePlay = (track: any) => {
    console.log("Playing:", track);
  };

  const handleLike = (track: any) => {
    console.log("Liked:", track);
  };

  const handleAddToPlaylist = (track: any) => {
    console.log("Adding to playlist:", track);
  };

  return (
    <>
      <TopBar user={user} />
      <div className="p-6">
        <CategoryChips categories={categories} />
        
        {/* New Discover Section with API integration */}
        <DiscoverSection />
        
        {/* Existing sections using TrackCard */}
        <Section 
          title="Listen again"
          subtitle="DHRUV YADAV"
          showMoreButton
        >
          {listenAgainTracks.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track}
              onPlay={handlePlay}
              onLike={handleLike}
              onAddToPlaylist={handleAddToPlaylist}
            />
          ))}
        </Section>
        
        <Section title="Forgotten favourites">
          {forgottenFavorites.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track}
              onPlay={handlePlay}
              onLike={handleLike}
              onAddToPlaylist={handleAddToPlaylist}
            />
          ))}
        </Section>
      </div>
    </>
  );
}
