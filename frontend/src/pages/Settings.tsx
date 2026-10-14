import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '../lib/toast';
import { Button, Icon, inputClass } from '../components/ui';
import { errorMessage } from '../lib/api';
import { usePreferences, useUpdatePreferences, useUpdateProfile } from '../lib/queries';
import { PASSWORD_RULE } from './Auth';
import { setUser } from '../store/auth';
import { useAppDispatch, useAppSelector } from '../store';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-xl bg-surface p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const profile = useUpdateProfile();
  const { data: prefs } = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const [username, setUsername] = useState(user?.username ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try {
      const updated = await profile.mutateAsync({ username: username.trim() });
      dispatch(setUser(updated));
      toast('Profile updated');
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!PASSWORD_RULE.test(newPassword)) return toast('Password needs 8+ characters with a letter and a number');
    try {
      await profile.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast('Password changed');
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  const pref = <T,>(key: string, fallback: T) => ((prefs?.[key] as T | undefined) ?? fallback);
  const setPref = (key: string, value: unknown) => updatePrefs.mutate({ [key]: value }, { onError: (err) => toast(errorMessage(err)) });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <Panel title="Profile">
        <form onSubmit={saveProfile} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            Username
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <Button type="submit" disabled={!username.trim() || username === user?.username || profile.isPending}>
            Save
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted">{user?.email}</p>
      </Panel>
      <Panel title="Password">
        <form onSubmit={savePassword} className="flex flex-col gap-3">
          <input className={inputClass} type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <input className={inputClass} type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Button type="submit" className="self-start" disabled={!currentPassword || !newPassword || profile.isPending}>
            Change password
          </Button>
        </form>
      </Panel>
      <Panel title="Playback">
        <label className="flex items-center justify-between py-2 text-sm">
          Autoplay similar songs when the queue ends
          <input type="checkbox" role="switch" className="h-5 w-9 accent-white" checked={pref('autoplay', true)} onChange={(e) => setPref('autoplay', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-4 py-2 text-sm">
          Download quality
          <select className={`${inputClass} w-auto`} value={pref('download_quality', '192k')} onChange={(e) => setPref('download_quality', e.target.value)}>
            {['128k', '192k', '256k', '320k'].map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </label>
      </Panel>
      {user?.role === 'admin' && (
        <Link to="/admin" className="mb-8 flex items-center gap-3 rounded-xl bg-surface p-4 hover:bg-white/10">
          <Icon name="admin_panel_settings" /> Admin dashboard
        </Link>
      )}
    </div>
  );
}
