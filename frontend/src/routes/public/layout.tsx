import { useEffect } from "react";
import { Outlet } from "react-router";
import { useSelector, useDispatch } from "react-redux";
import Sidebar from "../../components/Sidebar";
import BottomPlayer from "../../components/BottomPlayer";
import TopBar from "../../components/TopBar";
import { getCurrentUser } from "../../store/slices/authSlice";
import type { RootState, AppDispatch } from "../../store";

export default function Layout() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, accessToken } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(getCurrentUser());
    }
  }, [accessToken, user, dispatch]);

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="flex">
        <Sidebar />
        <main className="main-content w-full bg-gray-900 min-h-screen pb-24 ml-[15rem]">
          <TopBar user={user ?? { username: "" }} />
          <Outlet />
        </main>
      </div>
      <BottomPlayer />
    </div>
  );
}
