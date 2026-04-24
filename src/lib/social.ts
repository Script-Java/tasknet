import { supabase } from './supabase';
import type { LeaderboardEntry, UserProfile } from './types';

export const social = {
  async createGroup(name: string, ownerId: string, inviteCode: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_group', {
      p_name: name,
      p_owner_id: ownerId,
      p_invite_code: inviteCode
    });
    if (error) throw error;
    return data as string;
  },

  async joinGroup(userId: string, inviteCode: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_group', {
      p_user_id: userId,
      p_invite_code: inviteCode
    });
    if (error) throw error;
    return data as string;
  },

  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const { error } = await supabase.rpc('leave_group', {
      p_user_id: userId,
      p_group_id: groupId
    });
    if (error) throw error;
  },

  async getGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_group_leaderboard', {
      p_group_id: groupId
    });
    if (error) throw error;
    return data as unknown as LeaderboardEntry[];
  },

  async updateProfile(userId: string, username: string | null, avatarUrl: string | null): Promise<void> {
    const { error } = await supabase.rpc('update_profile', {
      p_user_id: userId,
      p_username: username,
      p_avatar_url: avatarUrl
    });
    if (error) throw error;
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase.rpc('get_user_profile', {
      p_user_id: userId
    });
    if (error) throw error;
    return data as unknown as UserProfile | null;
  }
};
