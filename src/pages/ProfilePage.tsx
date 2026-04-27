import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { social } from '../lib/social';
import { gamification } from '../lib/gamification';
import { BadgeGallery } from '../components/BadgeGallery';
import { GroupsPage } from './GroupsPage';
import { BADGES } from '../lib/badges';
import type { UserProfile, UserStats, Achievement } from '../lib/types';
import { User, Award, CheckCircle, Zap, Edit3, Save, X, Camera, Clock, Settings as SettingsIcon, Trophy, TrendingUp, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

type Tab = 'profile' | 'preferences' | 'achievements' | 'groups';

const EMPTY_PROFILE: UserProfile = {
  id: '',
  username: null,
  avatar_url: null,
  email: null,
  xp: 0,
  level: 0,
  recent_todos: [],
  recent_habits: [],
};

export function ProfilePage({ userId }: { userId: string }) {
  const { id: routeUserId } = useParams<{ id: string }>();
  const viewUserId = routeUserId || userId;
  const isOwnProfile = viewUserId === userId;

  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [workStart, setWorkStart] = useState(() => localStorage.getItem('fides_work_start') || '09:00');
  const [workEnd, setWorkEnd] = useState(() => localStorage.getItem('fides_work_end') || '17:00');

  const ensureAndLoadProfile = useCallback(async () => {
    try {
      setLoading(true);
      if (isOwnProfile) {
        try {
          await social.ensureProfile();
        } catch {
          // May already exist, that's fine
        }
      }
      try {
        const data = await social.getUserProfile(viewUserId);
        setProfile(data);
      } catch {
        // RPC may fail if migration not applied yet — build a fallback
        const { data: authUser } = await supabase.auth.getUser();
        const fallback: UserProfile = {
          id: viewUserId,
          username: authUser?.user?.user_metadata?.username || authUser?.user?.email?.split('@')[0] || null,
          avatar_url: authUser?.user?.user_metadata?.avatar_url || null,
          email: authUser?.user?.email || null,
          xp: 0,
          level: 0,
          recent_todos: [],
          recent_habits: [],
        };
        try {
          const s = await gamification.getUserStats(viewUserId);
          fallback.xp = s.xp;
          fallback.level = s.level;
        } catch {
          // Stats not available either
        }
        setProfile(fallback);
      }
    } catch {
      setProfile({ ...EMPTY_PROFILE, id: viewUserId });
    } finally {
      setLoading(false);
    }
  }, [viewUserId, isOwnProfile]);

  const loadStats = useCallback(async () => {
    if (!isOwnProfile) return;
    try {
      const [s, a] = await Promise.all([
        gamification.getUserStats(userId),
        gamification.getAchievements(userId),
      ]);
      setStats(s);
      setAchievements(a);
    } catch {
      // Stats not available yet
    }
  }, [userId, isOwnProfile]);

  const loadOthersAchievements = useCallback(async () => {
    if (isOwnProfile) return;
    try {
      const a = await gamification.getAchievements(viewUserId);
      setAchievements(a);
    } catch {
    }
  }, [viewUserId, isOwnProfile]);

  useEffect(() => {
    ensureAndLoadProfile();
    loadStats();
    loadOthersAchievements();
  }, [ensureAndLoadProfile, loadStats]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      if (meta?.work_start) setWorkStart(meta.work_start);
      if (meta?.work_end) setWorkEnd(meta.work_end);
    });
  }, []);

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      toast.error('Username cannot be empty');
      return;
    }
    try {
      await social.updateProfile(editUsername.trim());
      toast.success('Profile updated!');
      setEditing(false);
      ensureAndLoadProfile();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Username already taken');
      } else {
        toast.error('Failed to update profile');
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    try {
      setAvatarUploading(true);
      const url = await social.uploadAvatar(file);
      const username = profile?.username || `user_${viewUserId.slice(0, 8)}`;
      await social.updateProfile(username, url);
      toast.success('Avatar updated!');
      ensureAndLoadProfile();
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { work_start: workStart, work_end: workEnd },
      });
      if (error) throw error;
      localStorage.setItem('fides_work_start', workStart);
      localStorage.setItem('fides_work_end', workEnd);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8E89B3]">Profile not found.</p>
      </div>
    );
  }

  const level = Math.floor(Math.sqrt(profile.xp / 10));
  const nextLevelXp = ((level + 1) * (level + 1)) * 10;
  const currentLevelXp = level * level * 10;
  const xpProgress = level > 0 ? ((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 : Math.min((profile.xp / nextLevelXp) * 100, 100);

  const xpProgressStats = stats
    ? stats.next_level_xp > 0
      ? Math.round(((stats.xp - stats.level * stats.level * 10) / (stats.next_level_xp - stats.level * stats.level * 10)) * 100)
      : 0
    : 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'achievements', label: 'Achievements', icon: <Trophy className="w-4 h-4" /> },
    { id: 'preferences', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" />, ownerOnly: true },
    { id: 'groups', label: 'Groups', icon: <Users className="w-4 h-4" />, ownerOnly: true },
  ];

  const visibleTabs = tabs.filter(t => isOwnProfile || !t.ownerOnly);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#EEEEF8]">
          {isOwnProfile ? 'Profile' : `${profile.username || profile.email || 'User'}'s Profile`}
        </h1>
        <p className="text-[#8E89B3] mt-1 md:mt-2 text-base md:text-lg">
          {isOwnProfile ? 'Your account and progress.' : 'Viewing their progress.'}
        </p>
      </div>

      <div className="flex gap-1 bg-[rgba(21,18,42,0.75)] p-1 rounded-2xl border border-[#2A2545] overflow-x-auto custom-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-0 flex items-center justify-center space-x-1 md:space-x-2 py-2.5 px-2 md:px-3 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.id
                ? 'bg-[rgba(139,92,246,0.2)] text-[#A78BFA] border border-[rgba(139,92,246,0.3)]'
                : 'text-[#5C5780] hover:text-[#8E89B3]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="space-y-6">
          <div className="galaxy-card p-5 md:p-8">
            <div className="flex items-center space-x-4 md:space-x-5">
              <div className="relative flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-md shadow-[#8B5CF6]/20" />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] flex items-center justify-center shadow-md shadow-[#8B5CF6]/30">
                    <User className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-[#FFB74D] to-[#FFA726] flex items-center justify-center shadow-lg shadow-[#FFB74D]/40 border-2 border-[#0D0B1E]">
                  <span className="text-[10px] md:text-xs font-black text-[#0D0B1E]">{level}</span>
                </div>
                {isOwnProfile && (
                  <label className="absolute -top-1 -left-1 w-6 h-6 md:w-7 md:h-7 bg-[#8B5CF6] rounded-lg flex items-center justify-center cursor-pointer hover:bg-[#A78BFA] transition shadow-lg shadow-[#8B5CF6]/40">
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={avatarUploading} />
                    <Camera className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                  </label>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="galaxy-input !py-2 !text-sm"
                      maxLength={20}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                    />
                    <button onClick={handleSaveProfile} className="p-1.5 text-[#66BB6A] hover:text-[#81C784] transition"><Save className="w-5 h-5" /></button>
                    <button onClick={() => setEditing(false)} className="p-1.5 text-[#5C5780] hover:text-[#EF5350] transition"><X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl md:text-2xl font-black text-[#EEEEF8] truncate">
                      {profile.username || profile.email || 'Anonymous'}
                    </h2>
                    {isOwnProfile && (
                      <button onClick={() => { setEditing(true); setEditUsername(profile.username || ''); }} className="p-1 text-[#5C5780] hover:text-[#A78BFA] transition">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-[rgba(234,179,8,0.15)] to-[rgba(255,183,77,0.15)] text-[#FFB74D] border border-[rgba(234,179,8,0.3)]">
                    Level {level}
                  </span>
                  <span className="text-xs text-[#5C5780]">{profile.xp.toLocaleString()} XP</span>
                </div>
              </div>
            </div>

            <div className="mt-5 md:mt-6 pt-5 md:pt-6 border-t border-[#2A2545]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-[#FFB74D]" />
                  <span className="font-bold text-[#EEEEF8]">Level {level}</span>
                </div>
                <span className="text-sm text-[#8E89B3]">{profile.xp.toLocaleString()} XP</span>
              </div>
              <div className="galaxy-progress">
                <div className="galaxy-progress-fill" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
              </div>
              <p className="text-xs text-[#5C5780] mt-1">{Math.max(0, nextLevelXp - profile.xp)} XP to next level</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="galaxy-card p-4 md:p-5 rounded-2xl text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-[rgba(139,92,246,0.15)] mb-2">
                <Zap className="w-5 h-5 text-[#A78BFA]" />
              </div>
              <p className="text-lg md:text-xl font-black text-[#EEEEF8]">{profile.xp.toLocaleString()}</p>
              <p className="text-xs text-[#8E89B3] mt-0.5">Total XP</p>
            </div>
            <div className="galaxy-card p-4 md:p-5 rounded-2xl text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-[rgba(234,179,8,0.15)] mb-2">
                <Award className="w-5 h-5 text-[#FFB74D]" />
              </div>
              <p className="text-lg md:text-xl font-black text-[#EEEEF8]">{level}</p>
              <p className="text-xs text-[#8E89B3] mt-0.5">Level</p>
            </div>
            <div className="galaxy-card p-4 md:p-5 rounded-2xl text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-[rgba(102,187,106,0.15)] mb-2">
                <CheckCircle className="w-5 h-5 text-[#66BB6A]" />
              </div>
              <p className="text-lg md:text-xl font-black text-[#EEEEF8]">{profile.recent_todos.length}</p>
              <p className="text-xs text-[#8E89B3] mt-0.5">Completed Todos</p>
            </div>
            <div className="galaxy-card p-4 md:p-5 rounded-2xl text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-[rgba(100,181,246,0.15)] mb-2">
                <TrendingUp className="w-5 h-5 text-[#64B5F6]" />
              </div>
              <p className="text-lg md:text-xl font-black text-[#EEEEF8]">{profile.recent_habits.length}</p>
              <p className="text-xs text-[#8E89B3] mt-0.5">Active Habits</p>
            </div>
          </div>

          <div className="galaxy-card p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
              <CheckCircle className="w-5 h-5 text-[#66BB6A]" />
              <span>Completed Todos</span>
            </h3>
            {profile.recent_todos.length === 0 ? (
              <p className="text-[#8E89B3] text-center py-6 text-sm">No completed todos yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.recent_todos.map((todo) => (
                  <div key={todo.id} className="flex items-center justify-between p-3 bg-[rgba(21,18,42,0.6)] rounded-xl border border-[#2A2545]">
                    <span className="text-sm text-[#EEEEF8] truncate">{todo.title}</span>
                    <span className="text-xs text-[#5C5780] ml-4 flex-shrink-0">
                      {new Date(todo.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="galaxy-card p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
              <Zap className="w-5 h-5 text-[#A78BFA]" />
              <span>Active Habits</span>
            </h3>
            {profile.recent_habits.length === 0 ? (
              <p className="text-[#8E89B3] text-center py-6 text-sm">No active habits.</p>
            ) : (
              <div className="space-y-2">
                {profile.recent_habits.map((habit) => (
                  <div key={habit.id} className="flex items-center justify-between p-3 bg-[rgba(21,18,42,0.6)] rounded-xl border border-[#2A2545]">
                    <span className="text-sm text-[#EEEEF8] truncate">{habit.title}</span>
                    <span className="text-xs text-[#5C5780] ml-4 flex-shrink-0">
                      {habit.last_completed_date ? new Date(habit.last_completed_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {tab === 'preferences' && isOwnProfile && (
        <div className="galaxy-card p-5 md:p-8 space-y-6">
          <div>
            <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
              <Clock className="w-5 h-5 text-[#64B5F6]" />
              <span>Work Hours</span>
            </h3>
            <p className="text-[#8E89B3] mb-4 text-sm md:text-base">Fides uses these hours to automatically schedule your tasks.</p>
            <div className="flex items-center space-x-4">
              <div className="space-y-1 flex-1">
                <label className="text-sm font-medium text-[#8E89B3]">Start Time</label>
                <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="galaxy-input !py-2.5" />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-sm font-medium text-[#8E89B3]">End Time</label>
                <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="galaxy-input !py-2.5" />
              </div>
            </div>
            <button onClick={handleSavePreferences} className="galaxy-btn mt-4 !py-2.5 !px-5 !text-sm">
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* Achievements Tab */}
      {tab === 'achievements' && (
        <div className="space-y-6">
          {stats && (
            <div className="galaxy-card p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-[#A78BFA]" />
                  <span className="font-bold text-[#EEEEF8]">Level {stats.level}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-[#8E89B3]">
                  <span>{stats.xp.toLocaleString()} XP</span>
                  <span className="text-[#FFB74D] font-medium">{stats.coins} coins</span>
                </div>
              </div>
              <div className="galaxy-progress">
                <div className="galaxy-progress-fill" style={{ width: `${Math.min(100, Math.max(0, xpProgressStats))}%` }} />
              </div>
              <p className="text-xs text-[#5C5780] mt-1">{stats.next_level_xp - stats.xp} XP to next level</p>
            </div>
          )}

          <div className="galaxy-card p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg md:text-xl font-bold flex items-center space-x-2 text-[#EEEEF8]">
                <Trophy className="w-5 h-5 text-[#FFB74D]" />
                <span>Trophy Room</span>
              </h3>
              <span className="text-xs font-semibold text-[#5C5780] bg-[rgba(21,18,42,0.6)] px-2.5 py-1 rounded-full border border-[#2A2545]">
                {achievements.filter((a) => BADGES.some((b) => b.id === a.type)).length} / {BADGES.length}
              </span>
            </div>
            <BadgeGallery unlockedIds={achievements.map((a) => a.type)} />
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {tab === 'groups' && isOwnProfile && (
        <GroupsPage userId={userId} />
      )}
    </div>
  );
}