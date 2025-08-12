import { useState } from "react";
import SearchBar from "./SearchBar";
import type { User } from "../types/auth";
import { useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";
import type { AppDispatch } from "../store";

interface TopBarProps {
  user: User;
}

export default function TopBar({ user }: TopBarProps) {
  const dispatch = useDispatch<AppDispatch>();
  const firstLetter = user.username?.charAt(0).toUpperCase() || "?";
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout()); // clears redux + localStorage
    window.location.href = "/login"; // navigate to login page
  };

  return (
    <div className="top-bar sticky top-0 z-10 p-4 flex items-center justify-between bg-gray-900">
      {/* Left side - Search */}
      <div className="flex items-center w-1/3">
        <SearchBar />
      </div>

      {/* Right side - Notifications + User Menu */}
      <div className="flex items-center space-x-4 relative">
        <button className="text-gray-400 hover:text-white">
          <span className="material-icons">notifications</span>
        </button>

        <div className="relative">
          <button
            className="flex items-center space-x-2"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-black font-bold">
              {firstLetter}
            </div>
            <span className="font-medium text-sm">{user.username}</span>
            <span className="material-icons text-base">arrow_drop_down</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-gray-800 rounded-md shadow-lg z-50">
              <button
                onClick={() => setMenuOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Profile
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Settings
              </button>
              <hr className="border-gray-700" />
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
