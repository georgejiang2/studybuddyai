import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useRoomContext,
  useParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
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
  X,
} from 'lucide-react';
import { api, type SessionMessage, type SessionJoinPayload, type PartnerProfile } from '../api/client';
import styles from './StudySession.module.css';

interface Props {
  sessionPayload: SessionJoinPayload;
  partnerProfile: PartnerProfile | null;
  onEnd: () => void;
  onAddFriend: (partnerId: string) => void;
}

export default function StudySession({ sessionPayload, partnerProfile, onEnd, onAddFriend }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [friendAdded, setFriendAdded] = useState(false);

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

  if (!sessionPayload.token || !sessionPayload.livekitUrl) {
    return (
      <FallbackSession
        sessionPayload={sessionPayload}
        partnerProfile={partnerProfile}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        friendAdded={friendAdded}
        onAddFriend={handleAddFriend}
        onEnd={handleEndSession}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={sessionPayload.livekitUrl}
      token={sessionPayload.token}
      connect={true}
      className={styles.room}
      onDisconnected={handleEndSession}
    >
      <SessionContent
        sessionPayload={sessionPayload}
        partnerProfile={partnerProfile}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        friendAdded={friendAdded}
        onAddFriend={handleAddFriend}
        onEnd={handleEndSession}
      />
    </LiveKitRoom>
  );
}

function FallbackSession({
  sessionPayload,
  partnerProfile,
  chatOpen,
  setChatOpen,
  friendAdded,
  onAddFriend,
  onEnd,
}: {
  sessionPayload: SessionJoinPayload;
  partnerProfile: PartnerProfile | null;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  friendAdded: boolean;
  onAddFriend: () => void;
  onEnd: () => void;
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

        <div className={styles.controls}>
          <button
            className={`${styles.controlBtn} ${!micOn ? styles.controlOff : ''}`}
            onClick={() => setMicOn(!micOn)}
            title={micOn ? 'Mute' : 'Unmute'}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            className={`${styles.controlBtn} ${!camOn ? styles.controlOff : ''}`}
            onClick={() => setCamOn(!camOn)}
            title={camOn ? 'Camera off' : 'Camera on'}
          >
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button
            className={`${styles.controlBtn} ${partnerMuted ? styles.controlOff : ''}`}
            onClick={() => setPartnerMuted(!partnerMuted)}
            title={partnerMuted ? 'Unmute partner' : 'Mute partner'}
          >
            {partnerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat"
          >
            <MessageCircle size={20} />
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
            className={`${styles.controlBtn} ${styles.endBtn}`}
            onClick={onEnd}
            title="End session"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {chatOpen && (
        <ChatPanel
          sessionId={sessionPayload.sessionId}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

function SessionContent({
  sessionPayload,
  partnerProfile,
  chatOpen,
  setChatOpen,
  friendAdded,
  onAddFriend,
  onEnd,
}: {
  sessionPayload: SessionJoinPayload;
  partnerProfile: PartnerProfile | null;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  friendAdded: boolean;
  onAddFriend: () => void;
  onEnd: () => void;
}) {
  const room = useRoomContext();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);

  useEffect(() => {
    room.localParticipant.setCameraEnabled(true);
    room.localParticipant.setMicrophoneEnabled(true);
  }, [room]);

  const toggleMic = async () => {
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  const togglePartnerMute = () => {
    const next = !partnerMuted;
    setPartnerMuted(next);
    const remoteParticipants = participants.filter((p) => !p.isLocal);
    for (const rp of remoteParticipants) {
      for (const pub of rp.audioTrackPublications.values()) {
        if (pub.track) {
          pub.track.setVolume(next ? 0 : 1);
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
        <div className={styles.videoGrid}>
          <div className={styles.videoTile}>
            {localVideoTrack ? (
              <VideoTrack trackRef={localVideoTrack} className={styles.video} />
            ) : (
              <div className={styles.videoOff}>
                <VideoOff size={32} />
                <span>Camera off</span>
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

        <div className={styles.controls}>
          <button
            className={`${styles.controlBtn} ${!micOn ? styles.controlOff : ''}`}
            onClick={toggleMic}
            title={micOn ? 'Mute' : 'Unmute'}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            className={`${styles.controlBtn} ${!camOn ? styles.controlOff : ''}`}
            onClick={toggleCam}
            title={camOn ? 'Camera off' : 'Camera on'}
          >
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <button
            className={`${styles.controlBtn} ${partnerMuted ? styles.controlOff : ''}`}
            onClick={togglePartnerMute}
            title={partnerMuted ? 'Unmute partner' : 'Mute partner'}
          >
            {partnerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat"
          >
            <MessageCircle size={20} />
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
            className={`${styles.controlBtn} ${styles.endBtn}`}
            onClick={onEnd}
            title="End session"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {chatOpen && (
        <ChatPanel
          sessionId={sessionPayload.sessionId}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}

function ChatPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.getSessionMessages(sessionId);
      setMessages(res.messages);
    } catch {
      // ignore
    }
  }, [sessionId]);

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
