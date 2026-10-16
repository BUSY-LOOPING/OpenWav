import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/toast';
import { Spinner } from './components/ui';
import { onTokensChange } from './lib/api';
import Album from './pages/Album';
import Artist from './pages/Artist';
import { LoginPage, SignupPage } from './pages/Auth';
import Explore, { MoodPage } from './pages/Explore';
import Home from './pages/Home';
import Library from './pages/Library';
import NotFound from './pages/NotFound';
import Playlist from './pages/Playlist';
import OnlinePlaylist from './pages/OnlinePlaylist';
import Search from './pages/Search';
import SettingsPage from './pages/Settings';
import Watch from './pages/Watch';
import { loadUser, setUser } from './store/auth';
import { useAppDispatch, useAppSelector } from './store';

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Users = lazy(() => import('./pages/admin/Users'));
const Downloads = lazy(() => import('./pages/admin/Downloads'));
const Media = lazy(() => import('./pages/admin/Media'));
const Discovery = lazy(() => import('./pages/admin/Discovery'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));

const loading = <Spinner className="mx-auto mt-24" />;

export function RequireAuth({ children, role }: { children: ReactNode; role?: 'admin' }) {
  const { user, status } = useAppSelector((s) => s.auth);
  const location = useLocation();
  if (status !== 'ready') return loading;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(loadUser());
    const unsubscribe = onTokensChange((tokens) => {
      if (!tokens) dispatch(setUser(null));
    });
    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  return (
    <>
      <Suspense fallback={loading}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            <Route path="explore/mood/:mood" element={<MoodPage />} />
            <Route path="library" element={<Library />} />
            <Route path="search" element={<Search />} />
            <Route path="playlist/:id" element={<Playlist />} />
            <Route path="youtube/playlist/:id" element={<OnlinePlaylist />} />
            <Route path="album/:id" element={<Album />} />
            <Route path="artist/:id" element={<Artist />} />
            <Route path="watch/:id" element={<Watch />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route
            path="/admin"
            element={
              <RequireAuth role="admin">
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="media" element={<Media />} />
            <Route path="discovery" element={<Discovery />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
