import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useAudioPlayback,
  useTracks,
  useRoomContext,
  useParticipants,
  useConnectionState,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import type { RemoteAudioTrack } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageCircle,
  VolumeX,
  Volume2,
  Send,
  UserPlus,
  SkipForward,
  X,
} from 'lucide-react';
import { api, type SessionMessage, type SessionJoinPayload, type PartnerProfile } from '../api/client';
import styles from './StudySession.module.css';

// Subtle ping sound using Web Audio API — no external file needed
function playPing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio not available
  }
}

interface Props {
  sessionPayload: SessionJoinPayload;
  partnerProfile: PartnerProfile | null;
  onEnd: () => void;
  onSkip: () => void;
  onAddFriend: (partnerId: string) => void;
}

export default function StudySession({ sessionPayload, partnerProfile, onEnd, onSkip, onAddFriend }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [friendAdded, setFriendAdded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadCountRef = useRef(0);
  const latestMessageAtRef = useRef<string | null>(null);
  const lastSeenMessageAtRef = useRef<string | null>(null);
  const chatOpenRef = useRef(chatOpen);
  const bgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // Background poll for messages even when chat panel is closed
  useEffect(() => {
    const poll = async () => {
      if (chatOpenRef.current) return; // ChatPanel polls when open
      try {
        const res = await api.getSessionMessages(sessionPayload.sessionId);
        const messages = res.messages;
        const latestAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
        latestMessageAtRef.current = latestAt;

        const unreadIncoming = messages.filter(
          (m) =>
            m.senderId === sessionPayload.partnerId &&
            (!lastSeenMessageAtRef.current || m.createdAt > lastSeenMessageAtRef.current),
        ).length;

        if (unreadIncoming > unreadCountRef.current) {
          playPing();
        }
        unreadCountRef.current = unreadIncoming;
        setUnreadCount(unreadIncoming);
      } catch {
        // ignore
      }
    };
    poll(); // initial check
    bgPollRef.current = setInterval(poll, 3000);
    return () => { if (bgPollRef.current) clearInterval(bgPollRef.current); };
  }, [sessionPayload.sessionId, sessionPayload.partnerId]);

  const handleAddFriend = async () => {
    if (friendAdded) return;
    try {
      await api.sendFriendRequest(sessionPayload.partnerId);
      setFriendAdded(true);
      onAddFriend(sessionPayload.partnerId);
    } catch {
      // ignore
    }
  };

  const handleEndSession = async () => {
    try {
      await api.endSession(sessionPayload.sessionId);
    } catch {
      // ignore
    }
    onEnd();
  };

  const handleSkip = async () => {
    try {
      await api.skipSession(sessionPayload.sessionId);
    } catch {
      // ignore
    }
    onSkip();
  };

  const handleNewMessages = useCallback((messages: SessionMessage[]) => {
    const latestMessageAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
    latestMessageAtRef.current = latestMessageAt;

    if (chatOpen) {
      if (latestMessageAt) {
        lastSeenMessageAtRef.current = latestMessageAt;
      }
      unreadCountRef.current = 0;
      setUnreadCount(0);
      return;
    }

    const unreadIncoming = messages.filter(
      (message) =>
        message.senderId === sessionPayload.partnerId
        && (!lastSeenMessageAtRef.current || message.createdAt > lastSeenMessageAtRef.current),
    ).length;

    if (unreadIncoming > unreadCountRef.current) {
      playPing();
    }

    unreadCountRef.current = unreadIncoming;
    setUnreadCount(unreadIncoming);
  }, [chatOpen, sessionPayload.partnerId]);

  const handleChatToggle = () => {
    if (!chatOpen) {
      if (latestMessageAtRef.current) {
        lastSeenMessageAtRef.current = latestMessageAtRef.current;
      }
      unreadCountRef.current = 0;
      setUnreadCount(0);
    }
    setChatOpen(!chatOpen);
  };

  if (!sessionPayload.token || !sessionPayload.livekitUrl) {
    return (
      <FallbackSession
        sessionPayload={sessionPayload}
        partnerProfile={partnerProfile}
        chatOpen={chatOpen}
        onChatToggle={handleChatToggle}
        unreadCount={unreadCount}
        onNewMessages={handleNewMessages}
        friendAdded={friendAdded}
        onAddFriend={handleAddFriend}
        onEnd={handleEndSession}
        onSkip={handleSkip}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={sessionPayload.livekitUrl}
      token={sessionPayload.token}
      connect={true}
      audio={true}
      video={true}
      className={styles.room}
      onDisconnected={handleEndSession}
    >
      <RoomAudioRenderer />
      <SessionContent
        sessionPayload={sessionPayload}
        partnerProfile={partnerProfile}
        chatOpen={chatOpen}
        onChatToggle={handleChatToggle}
        unreadCount={unreadCount}
        onNewMessages={handleNewMessages}
        friendAdded={friendAdded}
        onAddFriend={handleAddFriend}
        onEnd={handleEndSession}
        onSkip={handleSkip}
      />
    </LiveKitRoom>
  );
}

function FallbackSession({
  sessionPayload,
  partnerProfile,
  chatOpen,
  onChatToggle,
  unreadCount,
  onNewMessages,
  friendAdded,
  onAddFriend,
  onEnd,
  onSkip,
}: {
  sessionPayload: SessionJoinPayload;
  partnerProfile: PartnerProfile | null;
  chatOpen: boolean;
  onChatToggle: () => void;
  unreadCount: number;
  onNewMessages: (messages: SessionMessage[]) => void;
  friendAdded: boolean;
  onAddFriend: () => void;
  onEnd: () => void;
  onSkip: () => void;
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch {
        // no camera access
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = micOn; });
  }, [micOn]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = camOn; });
  }, [camOn]);

  const partnerName = partnerProfile?.name ?? 'Study Partner';

  return (
    <div className={styles.room}>
      <div className={`${styles.videoArea} ${chatOpen ? styles.videoAreaShift : ''}`}>
        <div className={styles.videoGrid}>
          <div className={styles.videoTile}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={styles.video}
            />
            {!camOn && (
              <div className={styles.videoOff}>
                <VideoOff size={32} />
                <span>Camera off</span>
              </div>
            )}
            <span className={styles.nameTag}>You</span>
          </div>
          <div className={styles.videoTile}>
            <div className={styles.videoOff}>
              <div className={styles.partnerAvatar}>
                {partnerName.charAt(0).toUpperCase()}
              </div>
              <span>Waiting for {partnerName}...</span>
            </div>
            <span className={styles.nameTag}>{partnerName}</span>
          </div>
        </div>

        <div className={styles.matchBanner}>
          {sessionPayload.matchReason}
        </div>

        <ControlBar
          micOn={micOn}
          camOn={camOn}
          partnerMuted={partnerMuted}
          chatOpen={chatOpen}
          unreadCount={unreadCount}
          friendAdded={friendAdded}
          onToggleMic={() => setMicOn(!micOn)}
          onToggleCam={() => setCamOn(!camOn)}
          onTogglePartnerMute={() => setPartnerMuted(!partnerMuted)}
          onChatToggle={onChatToggle}
          onAddFriend={onAddFriend}
          onSkip={onSkip}
          onEnd={onEnd}
        />
      </div>

      {chatOpen && (
        <ChatPanel
          sessionId={sessionPayload.sessionId}
          onClose={onChatToggle}
          onMessageCount={onNewMessages}
        />
      )}
    </div>
  );
}

function SessionContent({
  sessionPayload,
  partnerProfile,
  chatOpen,
  onChatToggle,
  unreadCount,
  onNewMessages,
  friendAdded,
  onAddFriend,
  onEnd,
  onSkip,
}: {
  sessionPayload: SessionJoinPayload;
  partnerProfile: PartnerProfile | null;
  chatOpen: boolean;
  onChatToggle: () => void;
  unreadCount: number;
  onNewMessages: (messages: SessionMessage[]) => void;
  friendAdded: boolean;
  onAddFriend: () => void;
  onEnd: () => void;
  onSkip: () => void;
}) {
  const room = useRoomContext();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const connectionState = useConnectionState();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);

  // Enable camera and mic once connected
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || mediaReady) return;

    const enableMedia = async () => {
      try {
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
        setMediaReady(true);
      } catch {
        // retry after a short delay
        setTimeout(async () => {
          try {
            await room.localParticipant.setCameraEnabled(true);
            await room.localParticipant.setMicrophoneEnabled(true);
            setMediaReady(true);
          } catch {
            // give up silently
          }
        }, 1000);
      }
    };

    enableMedia();
  }, [connectionState, room, mediaReady]);

  const toggleMic = async () => {
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
    } catch {
      // ignore
    }
  };

  const toggleCam = async () => {
    const next = !camOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(next);
    } catch {
      // ignore
    }
  };

  const togglePartnerMute = () => {
    const next = !partnerMuted;
    setPartnerMuted(next);
    const remoteParticipants = participants.filter((p) => !p.isLocal);
    for (const rp of remoteParticipants) {
      for (const pub of rp.audioTrackPublications.values()) {
        if (pub.track && 'setVolume' in pub.track) {
          (pub.track as RemoteAudioTrack).setVolume(next ? 0 : 1);
        }
      }
    }
  };

  const localVideoTrack = tracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.Camera,
  );
  const remoteVideoTrack = tracks.find(
    (t) => !t.participant.isLocal && t.source === Track.Source.Camera,
  );

  const partnerName = partnerProfile?.name ?? 'Study Partner';
  const remoteParticipant = participants.find((p) => !p.isLocal);

  return (
    <>
      <div className={`${styles.videoArea} ${chatOpen ? styles.videoAreaShift : ''}`}>
        {!canPlayAudio && (
          <button
            type="button"
            className={styles.audioPrompt}
            onClick={() => {
              startAudio().catch(() => {
                // ignore, button stays visible until playback is allowed
              });
            }}
          >
            Click to enable call audio
          </button>
        )}
        <div className={styles.videoGrid}>
          <div className={styles.videoTile}>
            {localVideoTrack ? (
              <VideoTrack trackRef={localVideoTrack} className={styles.video} />
            ) : (
              <div className={styles.videoOff}>
                <VideoOff size={32} />
                <span>{connectionState === ConnectionState.Connected ? 'Camera off' : 'Connecting...'}</span>
              </div>
            )}
            <span className={styles.nameTag}>You</span>
          </div>
          <div className={styles.videoTile}>
            {remoteVideoTrack ? (
              <VideoTrack trackRef={remoteVideoTrack} className={styles.video} />
            ) : (
              <div className={styles.videoOff}>
                <div className={styles.partnerAvatar}>
                  {(remoteParticipant?.name || partnerName).charAt(0).toUpperCase()}
                </div>
                <span>{remoteParticipant ? `${remoteParticipant.name || partnerName} (camera off)` : `Waiting for ${partnerName}...`}</span>
              </div>
            )}
            <span className={styles.nameTag}>
              {remoteParticipant?.name || partnerName}
            </span>
          </div>
        </div>

        <div className={styles.matchBanner}>
          {sessionPayload.matchReason}
        </div>

        <ControlBar
          micOn={micOn}
          camOn={camOn}
          partnerMuted={partnerMuted}
          chatOpen={chatOpen}
          unreadCount={unreadCount}
          friendAdded={friendAdded}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onTogglePartnerMute={togglePartnerMute}
          onChatToggle={onChatToggle}
          onAddFriend={onAddFriend}
          onSkip={onSkip}
          onEnd={onEnd}
        />
      </div>

      {chatOpen && (
        <ChatPanel
          sessionId={sessionPayload.sessionId}
          onClose={onChatToggle}
          onMessageCount={onNewMessages}
        />
      )}
    </>
  );
}

function ControlBar({
  micOn,
  camOn,
  partnerMuted,
  chatOpen,
  unreadCount,
  friendAdded,
  onToggleMic,
  onToggleCam,
  onTogglePartnerMute,
  onChatToggle,
  onAddFriend,
  onSkip,
  onEnd,
}: {
  micOn: boolean;
  camOn: boolean;
  partnerMuted: boolean;
  chatOpen: boolean;
  unreadCount: number;
  friendAdded: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onTogglePartnerMute: () => void;
  onChatToggle: () => void;
  onAddFriend: () => void;
  onSkip: () => void;
  onEnd: () => void;
}) {
  return (
    <div className={styles.controls}>
      <button
        className={`${styles.controlBtn} ${!micOn ? styles.controlOff : ''}`}
        onClick={onToggleMic}
        title={micOn ? 'Mute' : 'Unmute'}
      >
        {micOn ? <Mic size={20} /> : <MicOff size={20} />}
      </button>
      <button
        className={`${styles.controlBtn} ${!camOn ? styles.controlOff : ''}`}
        onClick={onToggleCam}
        title={camOn ? 'Camera off' : 'Camera on'}
      >
        {camOn ? <Video size={20} /> : <VideoOff size={20} />}
      </button>
      <button
        className={`${styles.controlBtn} ${partnerMuted ? styles.controlOff : ''}`}
        onClick={onTogglePartnerMute}
        title={partnerMuted ? 'Unmute partner' : 'Mute partner'}
      >
        {partnerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      <button
        className={`${styles.controlBtn} ${chatOpen ? styles.controlActive : ''}`}
        onClick={onChatToggle}
        title="Chat"
      >
        <MessageCircle size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>
      <button
        className={`${styles.controlBtn} ${friendAdded ? styles.controlActive : ''}`}
        onClick={onAddFriend}
        title={friendAdded ? 'Friend request sent' : 'Add friend'}
        disabled={friendAdded}
      >
        <UserPlus size={20} />
      </button>
      <button
        className={`${styles.controlBtn} ${styles.skipBtn}`}
        onClick={onSkip}
        title="Skip to next partner"
      >
        <SkipForward size={20} />
      </button>
      <button
        className={`${styles.controlBtn} ${styles.endBtn}`}
        onClick={onEnd}
        title="End session"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
}

function ChatPanel({
  sessionId,
  onClose,
  onMessageCount,
}: {
  sessionId: string;
  onClose: () => void;
  onMessageCount: (messages: SessionMessage[]) => void;
}) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.getSessionMessages(sessionId);
      setMessages(res.messages);
      onMessageCount(res.messages);
    } catch {
      // ignore
    }
  }, [sessionId, onMessageCount]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 2000);
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
      await api.sendSessionMessage(sessionId, input.trim());
      setInput('');
      await fetchMessages();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <span>Session Chat</span>
        <button className={styles.chatClose} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.chatMessages}>
        {messages.length === 0 && (
          <div className={styles.chatEmpty}>No messages yet. Say hi!</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={styles.chatMsg}>
            <span className={styles.chatSender}>{msg.senderName}</span>
            <span className={styles.chatText}>{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className={styles.chatInput}>
        <input
          type="text"
          placeholder="Type a message..."
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
