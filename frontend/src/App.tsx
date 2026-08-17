import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store } from "./store";
import type { AppDispatch, RootState } from "./store";
import { getCurrentUser } from "./store/slices/authSlice";
import Home from "./routes/public/home";
import Layout from "./routes/public/layout";
import AdminLayoutRoute from "./routes/admin/layout";
import Playlist from "./routes/public/playlist";
import LoginPage from "./routes/LoginPage";
import SignupPage from "./routes/SignupPage";
import ProtectedRoute from "./components/ProtectedRoute";
import "./services/axiosInterceptor";
import SearchPage from "./routes/public/SearchPage";
import AdminSystemPage from "./routes/admin/AdminSystemPage";
import AdminUsersPage from "./routes/admin/AdminUsersPage";
import AdminDownloadsPage from "./routes/admin/AdminDownloadsPage";
import AdminYtdlpPage from "./routes/admin/AdminYtdlpPage";
import { useAudioPlayer } from "./hooks/useAudioPlayer";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { accessToken, user, isInitialized } = useSelector(
    (state: RootState) => state.auth,
  );

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, accessToken, user]);

  if (!isInitialized) {
    return (
      <div className="h-screen bg-[#030303] flex items-center justify-center">
        <svg
          className="w-10 h-10 animate-spin text-[#444]"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.2"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  return <>{children}</>;
}

const AppRoutes = () => {
  useAudioPlayer();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="playlist/:id" element={<Playlist />} />
          <Route path="search" element={<SearchPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayoutRoute />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminSystemPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="downloads" element={<AdminDownloadsPage />} />
          <Route path="ytdlp" element={<AdminYtdlpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <AuthInitializer>
        <AppRoutes />
      </AuthInitializer>
    </Provider>
  );
};

export default App;
