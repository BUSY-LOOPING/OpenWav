import { playlists } from "../data/mockData";

export default function Sidebar() {
  return (
    <aside className="sidebar fixed top-0 left-0 h-screen bg-black p-6 flex flex-col" style={{ width: '240px' }}>
      <div className="flex items-center mb-8">
        <span className="material-icons text-3xl mr-2">music_note</span>
        <h1 className="text-2xl font-bold">OpenWav</h1>
      </div>
      
      <nav className="flex flex-col space-y-4">
        <a className="flex items-center text-white bg-gray-800 px-4 py-2 rounded-md" href="#">
          <span className="material-icons mr-4">home</span>
          <span>Home</span>
        </a>
        <a className="flex items-center text-gray-400 hover:text-white" href="#">
          <span className="material-icons mr-4">explore</span>
          <span>Explore</span>
        </a>
        <a className="flex items-center text-gray-400 hover:text-white" href="#">
          <span className="material-icons mr-4">library_music</span>
          <span>Library</span>
        </a>
      </nav>
      
      <div className="mt-8 border-t border-gray-800 pt-4">
        <button className="flex items-center w-full text-gray-400 hover:text-white mb-4">
          <span className="material-icons mr-4 text-2xl">add_box</span>
          <span>New playlist</span>
        </button>
        
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <a key={playlist.id} className="block text-gray-400 hover:text-white" href="#">
              <p className="font-semibold">{playlist.name}</p>
              <p className="text-sm">{playlist.creator}</p>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
