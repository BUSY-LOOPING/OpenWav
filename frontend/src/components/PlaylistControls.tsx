import { useState } from "react";

export default function PlaylistControls() {
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  return (
    <div className="flex items-center space-x-3 mb-6">
      <button className="bg-white hover:bg-gray-50 text-black rounded-full p-4 transition-colors w-10 h-10 flex items-center justify-center">
        <span className="material-icons text-2xl">play_arrow</span>
      </button>
      
      <button 
        onClick={() => setIsLiked(!isLiked)}
        className="text-3xl hover:scale-105 transition-transform"
      >
        <span className={`material-icons ${isLiked ? 'text-green-500' : 'text-white/70'}`}>
          {isLiked ? 'favorite' : 'favorite_border'}
        </span>
      </button>
      
      <button className="text-white/70 hover:text-white transition-colors">
        <span className="material-icons text-2xl">more_horiz</span>
      </button>
      
      <button 
        onClick={() => setIsFollowing(!isFollowing)}
        className={`px-4 py-2 rounded-full border transition-colors ${
          isFollowing 
            ? 'border-white text-white hover:bg-white hover:text-black' 
            : 'border-white/30 text-white/70 hover:border-white hover:text-white'
        }`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
