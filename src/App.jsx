import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { auth, googleProvider, db, messaging } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import Nav from './components/Nav';
import ChatWidget from './components/ChatWidget';
import CalendarPage from './pages/CalendarPage';
import DriversPage from './pages/DriversPage';
import TeamsPage from './pages/TeamsPage';
import StandingsPage from './pages/StandingsPage';

const VAPID_KEY = 'BFnkYtDMzOQFz05eMPEVVbiTlMBOaiFkfMNKVY4CKPAqAyQHoCxT-IdPjN8fA2QwhnKV00H0CWJ81wHNVVj6xxQ';

function App() {
  const [user, setUser] = useState(null);
  const [followedDrivers, setFollowedDrivers] = useState([]);
  const [followedTeams, setFollowedTeams] = useState([]);

  // Chat widget state lives here now, so it survives page navigation.
  // Each entry in `chats` is self-contained: { race, formattedResults, messages, loading }
  const [chats, setChats] = useState({});
  const [chatInput, setChatInput] = useState({});
  const [activeRound, setActiveRound] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowedDrivers([]);
      setFollowedTeams([]);
      return;
    }
    const userDocRef = doc(db, 'users', user.uid);
    getDoc(userDocRef)
      .then(snap => {
        const data = snap.exists() ? snap.data() : {};
        setFollowedDrivers(data.followedDrivers || []);
        setFollowedTeams(data.followedTeams || []);
      })
      .catch(err => console.error('Failed to load follows:', err));
  }, [user]);

  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      new Notification(payload.notification.title, { body: payload.notification.body });
    });
    return unsubscribe;
  }, []);

  function handleSignIn() {
    signInWithPopup(auth, googleProvider).catch(err => console.error('Sign-in failed:', err));
  }

  function handleSignOut() {
    signOut(auth).catch(err => console.error('Sign-out failed:', err));
  }

  async function enableNotifications() {
    if (!user) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied.');
        return;
      }
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      if (token) {
        await setDoc(doc(db, 'users', user.uid), { fcmToken: token }, { merge: true });
        alert('Notifications enabled!');
      }
    } catch (err) {
      console.error('Failed to enable notifications:', err);
    }
  }

  async function toggleFollowDriver(driverNumber) {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const isFollowing = followedDrivers.includes(driverNumber);
    try {
      await setDoc(userDocRef, {
        followedDrivers: isFollowing ? arrayRemove(driverNumber) : arrayUnion(driverNumber)
      }, { merge: true });
      setFollowedDrivers(prev => isFollowing ? prev.filter(n => n !== driverNumber) : [...prev, driverNumber]);
    } catch (err) {
      console.error('Failed to update follow:', err);
    }
  }

  async function toggleFollowTeam(teamName) {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const isFollowing = followedTeams.includes(teamName);
    try {
      await setDoc(userDocRef, {
        followedTeams: isFollowing ? arrayRemove(teamName) : arrayUnion(teamName)
      }, { merge: true });
      setFollowedTeams(prev => isFollowing ? prev.filter(t => t !== teamName) : [...prev, teamName]);
    } catch (err) {
      console.error('Failed to update follow:', err);
    }
  }

  // sessionOverride lets the very first message use a session we're about to
  // create, without waiting on React's async state update to land first.
  async function sendChatMessage(round, userText, sessionOverride) {
    const session = sessionOverride || chats[round];
    if (!session) return;

    const newMessages = [...(session.messages || []), { role: 'user', text: userText }];
    setChats(prev => ({ ...prev, [round]: { ...session, messages: newMessages, loading: true } }));

    try {
      const res = await fetch('/api/race-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceName: session.race.raceName,
          raceDate: session.race.date,
          results: session.formattedResults,
          messages: newMessages,
        }),
      });
      const data = await res.json();
      const replyText = data.reply || 'Failed to get a response.';
      setChats(prev => ({
        ...prev,
        [round]: { ...session, messages: [...newMessages, { role: 'model', text: replyText }], loading: false },
      }));
    } catch (err) {
      console.error('Chat request failed:', err);
      setChats(prev => ({
        ...prev,
        [round]: { ...session, messages: [...newMessages, { role: 'model', text: 'Failed to get a response.' }], loading: false },
      }));
    }
  }

  function openHighlights(race, formattedResults) {
    setActiveRound(race.round);
    setChatOpen(true);
    if (!chats[race.round]) {
      const initialSession = { race, formattedResults, messages: [], loading: true };
      setChats(prev => ({ ...prev, [race.round]: initialSession }));
      sendChatMessage(race.round, 'Summarize the highlights of this race.', initialSession);
    }
  }

  function handleSendFollowUp() {
    const text = chatInput[activeRound];
    if (!text || !text.trim()) return;
    setChatInput(prev => ({ ...prev, [activeRound]: '' }));
    sendChatMessage(activeRound, text.trim());
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ color: 'var(--red)', fontSize: '1.4rem', margin: 0 }}>MYF1</h1>
        {user ? (
          <div>
            <span style={{ marginRight: '1rem' }}>{user.displayName}</span>
            <button className="pixel-btn" onClick={enableNotifications} style={{ marginRight: '0.5rem' }}>NOTIFY ME</button>
            <button className="pixel-btn" onClick={handleSignOut}>SIGN OUT</button>
          </div>
        ) : (
          <button className="pixel-btn" onClick={handleSignIn}>SIGN IN</button>
        )}
      </div>

      <Nav />
      <div className="checkered-divider"></div>

      <Routes>
        <Route path="/" element={<CalendarPage onOpenHighlights={openHighlights} />} />
        <Route
          path="/drivers"
          element={<DriversPage user={user} followedDrivers={followedDrivers} toggleFollowDriver={toggleFollowDriver} />}
        />
        <Route
          path="/teams"
          element={<TeamsPage user={user} followedTeams={followedTeams} toggleFollowTeam={toggleFollowTeam} />}
        />
        <Route path="/standings" element={<StandingsPage />} />
      </Routes>

      <ChatWidget
        isOpen={chatOpen}
        race={chats[activeRound]?.race || null}
        messages={chats[activeRound]?.messages || []}
        loading={chats[activeRound]?.loading || false}
        inputValue={chatInput[activeRound] || ''}
        onToggle={() => setChatOpen(prev => !prev)}
        onClose={() => setChatOpen(false)}
        onInputChange={(val) => setChatInput(prev => ({ ...prev, [activeRound]: val }))}
        onSend={handleSendFollowUp}
      />
    </div>
  );
}

export default App;