import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../../store";

import TopBar from "../../components/TopBar";
import CategoryChips from "../../components/CategoryChips";
import Section from "../../components/Section";
import DiscoverSection from "../../components/DiscoverSection";
import TrackCard from "../../components/TrackCard";

import {
  listenAgainTracks,
  forgottenFavorites,
  categories,
} from "../../data/mockData";
import { getCurrentUser } from "../../store/slices/authSlice";

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();

  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    console.log("Redux user:", user);
  }, [user]);

  useEffect(() => {
    if (!user) {
      dispatch(getCurrentUser());
    }
  }, [user, dispatch]);

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
      <div className="p-6">
        <CategoryChips categories={categories} />

        <DiscoverSection />

        <Section
          title="Listen again"
          subtitle={user?.username || "Your Music"}
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
