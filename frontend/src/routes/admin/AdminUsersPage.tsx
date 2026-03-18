import { useState } from 'react';
import { useAdminUsers, useUpdateUser, useDeleteUser } from '../../hooks/useAdminQueries';

const TABS = ['Overview', 'Groups', 'Banned'];

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-[#1e3a8a] text-blue-300 border-blue-800',
  user:  'bg-[#1a1a1a] text-gray-300 border-[#3f3f3f]',
};

const AVATAR_COLORS = ['bg-yellow-600', 'bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-pink-600'];
const avatarColor = (id: string) => AVATAR_COLORS[(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % AVATAR_COLORS.length];
const initials = (name: string) => name.slice(0, 2).toUpperCase();

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [search, setSearch]       = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage]           = useState(1);

  const { data, isLoading, isError } = useAdminUsers({
    search: searchQuery || undefined,
    page,
    limit: 20,
  });

  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const users      = data?.users ?? [];
  const pagination = data?.pagination;

  let searchTimer: ReturnType<typeof setTimeout>;
  function onSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { setSearchQuery(e.target.value); setPage(1); }, 400);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-8 px-8 border-b border-white/[0.06] shrink-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-[#777] hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 shrink-0 p-4 border-r border-white/[0.06] flex flex-col gap-0.5">
          {[{ label: 'Overview', icon: 'group' }, { label: 'Groups', icon: 'layers' }, { label: 'Banned', icon: 'block' }].map(item => (
            <button key={item.label} onClick={() => setActiveTab(item.label)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors text-left ${activeTab === item.label ? 'bg-white/10 text-white font-medium' : 'text-[#777] hover:text-white hover:bg-white/[0.05]'}`}>
              <span className="material-symbols-outlined text-[18px] leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Users <span className="text-[#555] font-normal text-xl">{isLoading ? '—' : pagination?.total ?? 0}</span>
            </h1>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-[18px]">search</span>
              <input value={search} onChange={onSearch} placeholder="Search users"
                className="bg-[#111] border border-white/[0.08] text-white text-sm pl-9 pr-4 py-2 rounded-lg w-64 outline-none focus:border-white/20 placeholder-[#555] transition-colors" />
            </div>
          </div>

          {isError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-6 p-3 bg-red-400/5 rounded-lg">
              <span className="material-symbols-outlined text-[18px]">error</span>
              Failed to load users. Check your connection.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="text-xs text-[#555] uppercase tracking-wider border-b border-white/[0.06]">
                  {['Role', 'Name', 'Email', 'Downloads', 'Last Login', 'Created', ''].map(h => (
                    <th key={h} className="pb-3 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/[0.04]">
                        {[60, 140, 180, 50, 80, 100, 20].map((w, j) => (
                          <td key={j} className="py-4 px-2">
                            <div className="h-3 bg-white/[0.06] rounded animate-pulse" style={{ width: w }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.map((user: any) => (
                      <tr key={user.id} className="group border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                        <td className="py-4 px-2">
                          <button
                            onClick={() => updateUser.mutate({ id: user.id, payload: { role: user.role === 'admin' ? 'user' : 'admin' } })}
                            disabled={updateUser.isPending}
                            className={`text-xs font-bold px-2.5 py-1 rounded border uppercase transition-colors ${ROLE_STYLES[user.role] ?? ROLE_STYLES.user}`}>
                            {user.role}
                          </button>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${avatarColor(user.id)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                              {initials(user.username)}
                            </div>
                            <span className="font-medium text-white text-sm group-hover:underline cursor-pointer">{user.username}</span>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-[#888] text-sm">{user.email}</td>
                        <td className="py-4 px-2 text-[#888] text-sm">{user.stats?.downloadCount ?? 0}</td>
                        <td className="py-4 px-2 text-[#888] text-sm">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—'}</td>
                        <td className="py-4 px-2 text-[#888] text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-2 text-right">
                          <button onClick={() => deleteUser.mutate(user.id)} disabled={deleteUser.isPending}
                            className="text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-white/[0.06] hover:bg-white/10 rounded-lg text-white disabled:opacity-30 transition-colors">Prev</button>
              <span className="text-sm text-[#555]">{page} / {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="px-3 py-1.5 text-sm bg-white/[0.06] hover:bg-white/10 rounded-lg text-white disabled:opacity-30 transition-colors">Next</button>
            </div>
          )}

          <p className="mt-6 text-xs text-[#555] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Click on the role badge to toggle between user and admin
          </p>
        </div>
      </div>
    </div>
  );
}