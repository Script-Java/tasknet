import { useEffect, useState, useCallback } from 'react';
import { social } from '../lib/social';
import { supabase } from '../lib/supabase';
import type { Group, GroupMemberWithProfile, LeaderboardEntry } from '../lib/types';
import { Users, Plus, LogOut, Trash2, Copy, Trophy, ArrowLeft, ChevronRight, Crown, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export function GroupsPage({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await social.getUserGroupsWithMemberCount();
      setGroups(data);
    } catch (e) {
      console.error('Failed to load groups:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    try {
      await social.createGroup(newGroupName.trim());
      toast.success('Group created!');
      setShowCreate(false);
      setNewGroupName('');
      await loadGroups();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create group';
      toast.error(msg.includes('foreign') || msg.includes('constraint') ? 'Please try again — your profile is being set up.' : msg);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      await social.joinGroup(inviteCode.trim().toUpperCase());
      toast.success('Joined group!');
      setShowJoin(false);
      setInviteCode('');
      await loadGroups();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to join group';
      toast.error(msg);
    }
  };

  const handleLeave = async (groupId: string) => {
    if (!confirm('Leave this group?')) return;
    try {
      await social.leaveGroup(groupId);
      toast.success('Left group');
      setSelectedGroup(null);
      await loadGroups();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to leave group';
      toast.error(msg);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Delete this group permanently?')) return;
    try {
      await social.deleteGroup(groupId);
      toast.success('Group deleted');
      setSelectedGroup(null);
      await loadGroups();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete group';
      toast.error(msg);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };

  if (selectedGroup) {
    return (
      <GroupDetail
        groupId={selectedGroup}
        userId={userId}
        onBack={() => setSelectedGroup(null)}
        onLeave={handleLeave}
        onDelete={handleDelete}
        copyInviteCode={copyInviteCode}
      />
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#EEEEF8]">Groups</h1>
          <p className="text-[#8E89B3] mt-1 text-sm md:text-base">Compete with friends and track each other's progress.</p>
        </div>
        <div className="flex space-x-2 self-start sm:self-auto">
          <button
            onClick={() => setShowJoin(true)}
            className="galaxy-btn-ghost flex items-center space-x-1.5"
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Join</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="galaxy-btn flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Group</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="galaxy-card p-4 md:p-6 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-[#EEEEF8]">Create a Group</h3>
          <p className="text-sm text-[#8E89B3]">Create a group and share the invite code with friends.</p>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Group name"
            className="galaxy-input"
            maxLength={50}
            autoFocus
          />
          <div className="flex space-x-3">
            <button onClick={handleCreate} className="galaxy-btn">Create</button>
            <button onClick={() => { setShowCreate(false); setNewGroupName(''); }} className="galaxy-btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="galaxy-card p-4 md:p-6 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-[#EEEEF8]">Join a Group</h3>
          <p className="text-sm text-[#8E89B3]">Enter the invite code shared by a friend.</p>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Enter invite code"
            className="galaxy-input font-mono tracking-widest text-center uppercase"
            maxLength={8}
            autoFocus
          />
          <div className="flex space-x-3">
            <button onClick={handleJoin} className="galaxy-btn">Join</button>
            <button onClick={() => { setShowJoin(false); setInviteCode(''); }} className="galaxy-btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6]" />
        </div>
      ) : groups.length === 0 ? (
        <div className="galaxy-card p-6 md:p-12 rounded-3xl text-center">
          <Users className="w-10 h-10 md:w-16 md:h-16 mx-auto text-[#5C5780] mb-3 md:mb-4" />
          <h3 className="text-base md:text-xl font-bold text-[#EEEEF8]">No groups yet</h3>
          <p className="text-[#8E89B3] mt-2 text-sm md:text-base">Create or join a group to start competing with friends.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group.id)}
              className="galaxy-card w-full group flex items-center justify-between p-4 md:p-5 rounded-2xl hover:border-[#8B5CF6]/50 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <p className="font-semibold text-[#EEEEF8] truncate">{group.name}</p>
                  {group.owner_id === userId && (
                    <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center space-x-3 mt-1.5">
                  <span className="text-xs text-[#8E89B3] flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{group.member_count ?? 1} member{(group.member_count ?? 1) !== 1 ? 's' : ''}</span>
                  </span>
                  <span className="text-xs text-[#8E89B3]">
                    Code: <span className="font-mono font-bold tracking-wider text-[#A78BFA]">{group.invite_code}</span>
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#5C5780] group-hover:text-[#8B5CF6] transition-colors flex-shrink-0 ml-2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDetail({
  groupId,
  userId,
  onBack,
  onLeave,
  onDelete,
  copyInviteCode,
}: {
  groupId: string;
  userId: string;
  onBack: () => void;
  onLeave: (groupId: string) => void;
  onDelete: (groupId: string) => void;
  copyInviteCode: (code: string) => void;
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'members'>('leaderboard');
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
      setGroup(g);

      const [memberData, lbData] = await Promise.all([
        social.getGroupMembersWithProfiles(groupId).catch(() => []),
        social.getLeaderboard(groupId).catch(() => []),
      ]);
      setMembers(memberData);
      setLeaderboard(lbData);
    } catch {
      // Group not found or feature unavailable
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !group) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6]" />
      </div>
    );
  }

  const isOwner = group.owner_id === userId;
  const currentUserId = userId;

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="flex items-center space-x-2 text-[#8E89B3] hover:text-[#EEEEF8] transition-colors text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to groups</span>
      </button>

      <div className="galaxy-card p-5 md:p-6 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-[#EEEEF8]">{group.name}</h2>
                {isOwner && (
                  <span className="text-xs font-medium text-yellow-400 flex items-center space-x-1">
                    <Crown className="w-3.5 h-3.5" />
                    <span>You own this group</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <span className="text-sm text-[#8E89B3] flex items-center space-x-1.5">
                <Users className="w-4 h-4" />
                <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
              </span>
              <span className="text-sm text-[#8E89B3] flex items-center space-x-1.5">
                Invite: <span className="font-mono font-bold tracking-wider bg-[rgba(139,92,246,0.15)] text-[#A78BFA] px-2 py-0.5 rounded">{group.invite_code}</span>
                <button onClick={() => copyInviteCode(group.invite_code)} className="text-[#8B5CF6] hover:text-[#A78BFA] transition-colors ml-1">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          </div>

          <div className="flex space-x-2 self-start sm:self-auto">
            {isOwner ? (
              <button onClick={() => onDelete(groupId)} className="flex items-center space-x-2 px-4 py-2.5 bg-[rgba(239,68,68,0.1)] text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold hover:bg-[rgba(239,68,68,0.2)] transition">
                <Trash2 className="w-4 h-4" />
                <span>Delete Group</span>
              </button>
            ) : (
              <button onClick={() => onLeave(groupId)} className="galaxy-btn-ghost flex items-center space-x-2">
                <LogOut className="w-4 h-4" />
                <span>Leave Group</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-[rgba(21,18,42,0.75)] p-1 rounded-2xl border border-[#2A2545]">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-[rgba(139,92,246,0.2)] text-[#A78BFA] border border-[rgba(139,92,246,0.3)]'
              : 'text-[#5C5780] hover:text-[#8E89B3]'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Leaderboard</span>
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'members'
              ? 'bg-[rgba(139,92,246,0.2)] text-[#A78BFA] border border-[rgba(139,92,246,0.3)]'
              : 'text-[#5C5780] hover:text-[#8E89B3]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members</span>
        </button>
      </div>

      {activeTab === 'leaderboard' && (
        <div className="galaxy-card p-4 md:p-6 rounded-3xl">
          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span>Leaderboard</span>
          </h3>
          {leaderboard.length === 0 ? (
            <p className="text-[#8E89B3] text-center py-8">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <button
                  key={entry.user_id}
                  onClick={() => navigate(`/profile/${entry.user_id}`)}
                  className="galaxy-card w-full flex items-center justify-between p-3 md:p-4 rounded-2xl hover:border-[#8B5CF6]/50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3 md:space-x-4 min-w-0">
                    <span className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 ${
                      entry.rank === 1 ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400' :
                      entry.rank === 2 ? 'bg-[rgba(139,92,246,0.15)] text-[#A78BFA]' :
                      entry.rank === 3 ? 'bg-[rgba(249,115,22,0.15)] text-orange-400' :
                      'bg-[rgba(92,87,128,0.2)] text-[#8E89B3]'
                    }`}>
                      {entry.rank}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#EEEEF8] truncate text-sm md:text-base">
                        {entry.username || entry.email || 'Anonymous'}
                        {entry.user_id === currentUserId && <span className="text-xs text-[#8B5CF6] ml-2">(You)</span>}
                      </p>
                      <p className="text-xs text-[#8E89B3]">Level {entry.level}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-bold text-[#EEEEF8] text-sm md:text-base">{entry.xp.toLocaleString()} XP</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="galaxy-card p-4 md:p-6 rounded-3xl">
          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
            <Users className="w-5 h-5 text-[#A78BFA]" />
            <span>Members</span>
          </h3>
          {members.length === 0 ? (
            <p className="text-[#8E89B3] text-center py-8">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <button
                  key={member.user_id}
                  onClick={() => navigate(`/profile/${member.user_id}`)}
                  className="galaxy-card w-full flex items-center justify-between p-3 md:p-4 rounded-2xl hover:border-[#8B5CF6]/50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3 md:space-x-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md shadow-[#8B5CF6]/20">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-[#EEEEF8] truncate text-sm md:text-base">
                          {member.username || member.email || 'Anonymous'}
                        </p>
                        {member.user_id === currentUserId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(139,92,246,0.2)] text-[#A78BFA] font-semibold border border-[rgba(139,92,246,0.3)]">You</span>
                        )}
                        {member.user_id === group.owner_id && (
                          <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#8E89B3]">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                    <div className="text-right">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.15)] text-[#A78BFA] border border-[rgba(139,92,246,0.2)]">
                          Lv. {member.level}
                        </span>
                        <span className="text-xs text-[#8E89B3]">{member.xp.toLocaleString()} XP</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5C5780]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}