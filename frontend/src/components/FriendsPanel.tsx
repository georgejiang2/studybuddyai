import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { MessageCircle, Clock, Send, ArrowLeft, Users } from 'lucide-react';
import { api, type Friendship, type FriendMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './FriendsPanel.module.css';

function getPartnerId(friendship: Friendship, userId: string) {
  return friendship.requesterId === userId ? friendship.recipientId : friendship.requesterId;
}

export default function FriendsPanel() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friendship | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadByFriendship, setUnreadByFriendship] = useState<Record<string, number>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.getFriends();
      setFriends(res.friendships);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Poll unread counts for accepted friends
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const accepted = friends.filter((f) => f.status === 'accepted');
      if (accepted.length === 0) return;

      try {
        const results = await Promise.all(
          accepted.map(async (f) => {
            const partnerId = getPartnerId(f, user.id);
            const res = await api.getFriendChat(partnerId);
            const lastReadKey = `sb_lastread_${f.id}`;
            const lastReadAt = localStorage.getItem(lastReadKey) ?? '';
            const unread = res.messages.filter(
              (m) => m.senderId !== user.id && (!lastReadAt || m.createdAt > lastReadAt),
            ).length;
            return [f.id, unread] as const;
          }),
        );
        setUnreadByFriendship(Object.fromEntries(results));
      } catch {
        // ignore
      }
    };

    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, friends]);

  const handleAccept = async (friendshipId: string) => {
    try {
      await api.respondFriendRequest(friendshipId, 'accept');
      await fetchFriends();
    } catch {
      // ignore
    }
  };

  const handleReject = async (friendshipId: string) => {
    try {
      await api.respondFriendRequest(friendshipId, 'reject');
      await fetchFriends();
    } catch {
      // ignore
    }
  };

  const markRead = useCallback((friendshipId: string, latestAt?: string) => {
    if (!latestAt) return;
    localStorage.setItem(`sb_lastread_${friendshipId}`, latestAt);
    setUnreadByFriendship((prev) => ({ ...prev, [friendshipId]: 0 }));
  }, []);

  if (selectedFriend && user) {
    const partnerId = getPartnerId(selectedFriend, user.id);
    const partnerName = selectedFriend.partnerProfile?.name ?? 'Friend';
    return (
      <FriendChat
        key={selectedFriend.id}
        friendshipId={selectedFriend.id}
        friendId={partnerId}
        friendName={partnerName}
        onBack={() => setSelectedFriend(null)}
        onMarkRead={markRead}
      />
    );
  }

  const accepted = friends.filter((f) => f.status === 'accepted');
  const pendingIncoming = friends.filter(
    (f) => f.status === 'pending' && f.recipientId === user?.id,
  );
  const pendingOutgoing = friends.filter(
    (f) => f.status === 'pending' && f.requesterId === user?.id,
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Users size={20} />
        <h2>Friends</h2>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : friends.length === 0 ? (
        <div className={styles.empty}>
          <Users size={32} />
          <p>No friends yet</p>
          <span>Match with someone and add them as a friend!</span>
        </div>
      ) : (
        <div className={styles.list}>
          {pendingIncoming.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Friend Requests</h3>
              {pendingIncoming.map((f) => (
                <div key={f.id} className={styles.friendItem}>
                  <div className={styles.avatar}>
                    {(f.partnerProfile?.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.friendInfo}>
                    <span className={styles.friendName}>
                      {f.partnerProfile?.name ?? 'Unknown'}
                    </span>
                    <span className={styles.friendMeta}>
                      {f.partnerProfile?.school} &middot; {f.partnerProfile?.major}
                    </span>
                  </div>
                  <div className={styles.requestActions}>
                    <button className={styles.acceptBtn} onClick={() => handleAccept(f.id)}>
                      Accept
                    </button>
                    <button className={styles.rejectBtn} onClick={() => handleReject(f.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {accepted.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Your Friends</h3>
              {accepted.map((f) => (
                <button
                  key={f.id}
                  className={styles.friendItem}
                  onClick={() => setSelectedFriend(f)}
                >
                  <div className={styles.avatar}>
                    {(f.partnerProfile?.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.friendInfo}>
                    <span className={styles.friendName}>
                      {f.partnerProfile?.name ?? 'Unknown'}
                    </span>
                    <span className={styles.friendMeta}>
                      {f.partnerProfile?.school} &middot; {f.partnerProfile?.major}
                    </span>
                  </div>
                  <div className={styles.friendAction}>
                    <MessageCircle size={16} className={styles.chatIcon} />
                    {(unreadByFriendship[f.id] ?? 0) > 0 && (
                      <span className={styles.unreadBadge}>
                        {unreadByFriendship[f.id] > 9 ? '9+' : unreadByFriendship[f.id]}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {pendingOutgoing.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Pending</h3>
              {pendingOutgoing.map((f) => (
                <div key={f.id} className={styles.friendItem}>
                  <div className={styles.avatar}>
                    {(f.partnerProfile?.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.friendInfo}>
                    <span className={styles.friendName}>
                      {f.partnerProfile?.name ?? 'Unknown'}
                    </span>
                    <span className={styles.friendMeta}>Request sent</span>
                  </div>
                  <Clock size={16} className={styles.pendingIcon} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FriendChat({
  friendshipId,
  friendId,
  friendName,
  onBack,
  onMarkRead,
}: {
  friendshipId: string;
  friendId: string;
  friendName: string;
  onBack: () => void;
  onMarkRead: (friendshipId: string, latestAt?: string) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.getFriendChat(friendId);
      setMessages(res.messages);
      // Mark as read
      if (res.messages.length > 0) {
        onMarkRead(friendshipId, res.messages[res.messages.length - 1].createdAt);
      }
    } catch {
      // ignore
    }
  // onMarkRead is stable (useCallback with []) so this is safe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, friendshipId]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.sendFriendMessage(friendId, input.trim());
      setInput('');
      await fetchMessages();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.chatView}>
      <div className={styles.chatHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.chatAvatar}>
          {friendName.charAt(0).toUpperCase()}
        </div>
        <span className={styles.chatName}>{friendName}</span>
      </div>
      <div className={styles.chatMessages}>
        {messages.length === 0 && (
          <div className={styles.chatEmpty}>
            Start a conversation with {friendName}!
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.msgBubble} ${msg.senderId === user?.id ? styles.msgSent : styles.msgReceived}`}
          >
            <span className={styles.msgText}>{msg.text}</span>
            <span className={styles.msgTime}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className={styles.chatInput}>
        <input
          type="text"
          placeholder={`Message ${friendName}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
