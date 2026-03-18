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

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { accessToken, user, isInitialized } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, accessToken, user]);

  if (!isInitialized) {
    return (
      <div className="h-screen bg-[#030303] flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-[#444] animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  return <>{children}</>;
}

const AppRoutes = () => {
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
          <Route path="downloads" element={<AdminDownloadsPage/>} />
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
