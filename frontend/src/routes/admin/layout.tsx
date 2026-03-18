import { Outlet } from 'react-router';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { AdminLayout } from '../../components/layout/AdminLayout';

export default function AdminLayoutRoute() {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <AdminLayout
      activeHref={window.location.pathname}
      userName={user?.username ?? ''}
    >
      <Outlet />
    </AdminLayout>
  );
}