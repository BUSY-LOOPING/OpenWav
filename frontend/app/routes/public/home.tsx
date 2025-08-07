import TopBar from "../../components/TopBar";
import CategoryChips from "../../components/CategoryChips";
import Section from "../../components/Section";
import { listenAgainTracks, billboardTracks, forgottenFavorites, categories, user } from "../../data/mockData";

export default function Home() {
  return (
    <>
      <TopBar user={user} />
      <div className="p-6">
        <CategoryChips categories={categories} />
        
        <Section 
          title="Listen again"
          subtitle="DHRUV YADAV"
          tracks={listenAgainTracks}
          showMoreButton
        />
        
        <Section 
          title="Billboards"
          tracks={billboardTracks}
          showMoreButton
        />
        
        <Section 
          title="Forgotten favourites"
          tracks={forgottenFavorites}
        />
      </div>
    </>
  );
}
