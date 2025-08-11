import { currentTrack } from "../data/mockData";

export default function BottomPlayer() {
  return (
    <footer className="bottom-player fixed bottom-0 left-0 right-0 h-24 z-20 flex items-center justify-between px-4" style={{ backgroundColor: '#181818', borderTop: '1px solid #282828' }}>
      <div className="flex items-center space-x-4 w-1/4">
        <img 
          alt="Current track album art" 
          className="w-14 h-14 rounded-md" 
          src={currentTrack.albumArt}
        />
        <div>
          <h4 className="font-semibold">{currentTrack.title}</h4>
          <p className="text-sm text-gray-400">{currentTrack.artist}</p>
        </div>
        <button className="text-gray-400 hover:text-white">
          <span className="material-icons">favorite_border</span>
        </button>
      </div>
      
      <div className="flex flex-col items-center justify-center w-1/2">
        <div className="flex items-center space-x-6">
          <button className="text-gray-400 hover:text-white">
            <span className="material-icons">shuffle</span>
          </button>
          <button className="text-gray-400 hover:text-white">
            <span className="material-icons text-4xl">skip_previous</span>
          </button>
          <button className="bg-white text-black rounded-full p-2 hover:scale-105 h-14 w-14 flex items-center justify-center">
            <span className="material-icons p-0 m-0">pause</span>
          </button>
          <button className="text-gray-400 hover:text-white">
            <span className="material-icons text-4xl">skip_next</span>
          </button>
          <button className="text-gray-400 hover:text-white">
            <span className="material-icons">repeat</span>
          </button>
        </div>
        <div className="flex items-center space-x-2 w-full mt-2">
          <span className="text-xs text-gray-400">{currentTrack.currentTime}</span>
          <div className="progress-bar-container w-full h-1 rounded-full group" style={{ backgroundColor: '#404040' }}>
            <div 
              className="progress-bar h-1 rounded-full relative bg-white" 
              style={{ width: `${currentTrack.progress}%` }}
            >
              <div className="progress-handle w-3 h-3 bg-white rounded-full absolute right-0 -top-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </div>
          <span className="text-xs text-gray-400">{currentTrack.totalTime}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4 w-1/4 justify-end">
        <button className="text-gray-400 hover:text-white">
          <span className="material-icons">playlist_play</span>
        </button>
        <button className="text-gray-400 hover:text-white">
          <span className="material-icons">devices</span>
        </button>
        <div className="flex items-center space-x-2">
          <button className="text-gray-400 hover:text-white">
            <span className="material-icons">volume_up</span>
          </button>
          <div className="w-24 h-1 bg-gray-600 rounded-full">
            <div className="w-1/2 h-1 bg-white rounded-full"></div>
          </div>
        </div>
      </div>
    </footer>
  );
}
