import SearchBar from "./SearchBar";
import {user} from "../data/mockData";
import type {User} from "../index";

interface TopBarProps {
  user: User;
}

export default function TopBar({ user }: TopBarProps) {

  return (
    <div className="top-bar sticky top-0 z-10 p-4 flex items-center justify-between">
      <div className="flex items-center w-1/3">
        <SearchBar />
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="text-gray-400 hover:text-white">
          <span className="material-icons">notifications</span>
        </button>
        <div className="relative">
          <button className="flex items-center space-x-2">
            <img 
              alt="User profile image" 
              className="w-8 h-8 rounded-full" 
              src={user.avatar}
            />
            <span className="font-medium text-sm">{user.name}</span>
            <span className="material-icons text-base">arrow_drop_down</span>
          </button>
        </div>
      </div>
    </div>
  );
}
