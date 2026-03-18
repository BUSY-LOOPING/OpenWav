import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import BottomPlayer from '../../components/player/BottomPlayer';
import { getCurrentUser } from '../../store/slices/authSlice';
import type { RootState, AppDispatch } from '../../store';
import { AppLayout } from '../../components/layout/AppLayout';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

export default function Layout() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, accessToken } = useSelector((state: RootState) => state.auth);

  useAudioPlayer();

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(getCurrentUser());
    }
  }, [accessToken, user, dispatch]);

  return (
    <AppLayout
      userName={user?.username ?? ''}
      playerBar={<BottomPlayer />}
      activeHref={window.location.pathname}
    >
      <Outlet />
    </AppLayout>
  );
}