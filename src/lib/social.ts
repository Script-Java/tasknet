import { supabase } from './supabase';
import type { Group, GroupMember, GroupMemberWithProfile, LeaderboardEntry, UserProfile } from './types';

export const social = {
  async createGroup(name: string): Promise<Group> {
    await this.ensureProfile();
    const { data, error } = await supabase.rpc('create_group', { p_name: name });
    if (error) throw error;

    const { data: group, error: fetchError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) throw fetchError;
    return group;
  },

  async joinGroup(inviteCode: string): Promise<string> {
    await this.ensureProfile();
    const { data, error } = await supabase.rpc('join_group', { p_invite_code: inviteCode });
    if (error) throw error;
    return data;
  },

  async leaveGroup(groupId: string): Promise<void> {
    const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
    if (error) throw error;
  },

  async deleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_group', { p_group_id: groupId });
    if (error) throw error;
  },

  async getUserGroups(): Promise<Group[]> {
    const { data: memberOf, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user!.id);

    if (memberError) throw memberError;
    if (!memberOf || memberOf.length === 0) return [];

    const groupIds = memberOf.map((m: { group_id: string }) => m.group_id);

    const { data: groups, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    if (error) throw error;
    return groups || [];
  },

  async getUserGroupsWithMemberCount(): Promise<Group[]> {
    const groups = await this.getUserGroups();
    if (groups.length === 0) return [];

    const groupIds = groups.map(g => g.id);

    const { data: memberCounts, error } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);

    if (error || !memberCounts) return groups;

    const countMap = new Map<string, number>();
    for (const m of memberCounts) {
      countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1);
    }

    return groups.map(g => ({
      ...g,
      member_count: countMap.get(g.id) || 0,
    }));
  },

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select('id, group_id, user_id, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data as GroupMember[];
  },

  async getGroupMembersWithProfiles(groupId: string): Promise<GroupMemberWithProfile[]> {
    const members = await this.getGroupMembers(groupId);
    if (members.length === 0) return [];

    const userIds = members.map(m => m.user_id);

    const profilesRes = await supabase.from('users').select('id, username, avatar_url, xp').in('id', userIds);
    let emailsData: { user_id: string; email: string }[] = [];
    try {
      const { data } = await supabase.rpc('get_user_emails', { p_user_ids: userIds });
      emailsData = (data || []) as { user_id: string; email: string }[];
    } catch { /* emails optional */ }

    const profiles = profilesRes.data || [];

    const profileMap = new Map<string, { username: string | null; avatar_url: string | null; xp: number }>();
    for (const p of profiles) {
      profileMap.set(p.id, { username: p.username, avatar_url: p.avatar_url, xp: p.xp });
    }

    const emailMap = new Map<string, string>();
    for (const e of emailsData) {
      if (e.email) emailMap.set(e.user_id, e.email);
    }

    return members.map(m => {
      const profile = profileMap.get(m.user_id) || { username: null, avatar_url: null, xp: 0 };
      return {
        ...m,
        username: profile.username,
        avatar_url: profile.avatar_url,
        email: emailMap.get(m.user_id) || null,
        xp: profile.xp,
        level: Math.floor(Math.sqrt(profile.xp / 10)),
      };
    });
  },

  async getLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_group_members_leaderboard', {
      p_group_id: groupId,
    });
    if (error) throw error;
    const entries = (data || []) as LeaderboardEntry[];

    if (entries.length === 0) return entries;

    const userIds = entries.map(e => e.user_id);
    const { data: profiles } = await supabase
      .from('users')
      .select('id, avatar_url')
      .in('id', userIds);

    const avatarMap = new Map<string, string | null>();
    for (const p of (profiles || [])) {
      avatarMap.set(p.id, p.avatar_url);
    }

    return entries.map(e => ({
      ...e,
      avatar_url: avatarMap.get(e.user_id) || null,
    }));
  },

  async updateProfile(username: string, avatarUrl?: string): Promise<void> {
    const { error } = await supabase.rpc('update_profile', {
      p_username: username,
      p_avatar_url: avatarUrl ?? null,
    });
    if (error) throw error;
  },

  async getUserProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase.rpc('get_user_profile', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data as unknown as UserProfile;
  },

  async ensureProfile(): Promise<void> {
    const { error } = await supabase.rpc('ensure_user_profile');
    if (error) throw error;
  },

  async uploadAvatar(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }
    if (file.type === 'image/svg+xml') {
      throw new Error('SVG uploads are not allowed for security reasons');
    }
    const userId = (await supabase.auth.getUser()).data.user!.id;
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  },
};