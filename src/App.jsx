import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { auth, googleProvider, db, messaging } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import TeamsPage from './pages/TeamsPage';
import Nav from './components/Nav';
import CalendarPage from './pages/CalendarPage';
import DriversPage from './pages/DriversPage';
import StandingsPage from './pages/StandingsPage';

const VAPID_KEY = 'BFnkYtDMzOQFz05eMPEVVbiTlMBOaiFkfMNKVY4CKPAqAyQHoCxT-IdPjN8fA2QwhnKV00H0CWJ81wHNVVj6xxQ';

function App() {
  const [user, setUser] = useState(null);
  const [followedDrivers, setFollowedDrivers] = useState([]);
  const [followedTeams, setFollowedTeams] = useState([]);

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
        <Route path="/" element={<CalendarPage />} />
        <Route
          path="/drivers"
          element={
            <DriversPage
              user={user}
              followedDrivers={followedDrivers}
              followedTeams={followedTeams}
              toggleFollowDriver={toggleFollowDriver}
              toggleFollowTeam={toggleFollowTeam}
            />
          }
        />
        <Route path="/standings" element={<StandingsPage />} />
        <Route
          path="/teams"
          element={
            <TeamsPage
              user={user}
              followedTeams={followedTeams}
              toggleFollowTeam={toggleFollowTeam}
            />
          }
        />
      </Routes>
    </div>
  );
}

export default App;