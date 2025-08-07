import { useState } from "react";

export default function SearchBar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");

  const filters = ["All", "Artists", "Songs", "Albums", "Podcasts"];

  return (
    <div className="relative w-full group">
      <div className="search-bar-container flex items-center rounded-full" style={{ backgroundColor: '#242424' }}>
        <div className="relative">
          <button 
            className="flex items-center space-x-2 text-sm pl-4 pr-2 py-2 rounded-l-full bg-gray-700 hover:bg-gray-600"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span>{selectedFilter}</span>
            <span className="material-icons text-base">arrow_drop_down</span>
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full mt-1 w-48 bg-gray-700 rounded-md shadow-lg z-50">
              {filters.map((filter) => (
                <a 
                  key={filter}
                  className="block px-4 py-2 text-sm text-white hover:bg-gray-600 cursor-pointer" 
                  onClick={() => {
                    setSelectedFilter(filter);
                    setIsDropdownOpen(false);
                  }}
                >
                  {filter}
                </a>
              ))}
            </div>
          )}
        </div>
        <span className="material-icons absolute left-[88px] top-1/2 -translate-y-1/2 text-gray-400">search</span>
        <input 
          className="search-input w-full pl-10 pr-4 py-2 rounded-r-full border-none focus:outline-none bg-transparent" 
          placeholder="Search" 
          type="text"
        />
      </div>
    </div>
  );
}
