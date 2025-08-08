import { Outlet } from "react-router";
import Sidebar from "../../components/Sidebar";
import BottomPlayer from "../../components/BottomPlayer";

export default function Layout() {
  return (
    <div className="bg-black text-white min-h-screen">
      <div className="flex">
        <Sidebar />
        <main className="main-content w-full bg-gray-900 min-h-screen pb-24 ml-60">
          <Outlet />
        </main>
      </div>
      <BottomPlayer />
    </div>
  );
}
