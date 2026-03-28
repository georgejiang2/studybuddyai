import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { MessageCircle, Clock, Send, ArrowLeft, Users } from 'lucide-react';
import { api, type Friendship, type FriendMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './FriendsPanel.module.css';

export default function FriendsPanel() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friendship | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (selectedFriend && user) {
    const partnerId = selectedFriend.requesterId === user.id
      ? selectedFriend.recipientId
      : selectedFriend.requesterId;
    const partnerName = selectedFriend.partnerProfile?.name ?? 'Friend';
    return (
      <FriendChat
        friendId={partnerId}
        friendName={partnerName}
        onBack={() => setSelectedFriend(null)}
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
                    <button
                      className={styles.acceptBtn}
                      onClick={() => handleAccept(f.id)}
                    >
                      Accept
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleReject(f.id)}
                    >
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
                  <MessageCircle size={16} className={styles.chatIcon} />
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
  friendId,
  friendName,
  onBack,
}: {
  friendId: string;
  friendName: string;
  onBack: () => void;
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
    } catch {
      // ignore
    }
  }, [friendId]);

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
