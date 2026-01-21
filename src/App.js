import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

/* 🔥 Firebase CONFIG (عدّلها ببياناتك) */
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= APP ================= */

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    signInAnonymously(auth);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-900 text-white">
      {view === "login" && <Login setView={setView} user={user} />}
      {view === "chat" && <Chat user={user} />}
    </div>
  );
}

/* ================= LOGIN ================= */

function Login({ setView, user }) {
  const [username, setUsername] = useState("");

  const login = async () => {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), {
      username,
      createdAt: serverTimestamp(),
    });

    setView("chat");
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <input
        className="p-3 rounded bg-zinc-800"
        placeholder="اسم المستخدم"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button
        onClick={login}
        className="bg-lime-600 px-6 py-2 rounded"
      >
        دخول
      </button>
    </div>
  );
}

/* ================= CHAT ================= */

function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("createdAt")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => d.data()));
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
    });

    return () => unsub();
  }, []);

  const send = async () => {
    if (!text) return;
    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 flex gap-2 bg-zinc-800">
        <input
          className="flex-1 p-2 rounded bg-zinc-700"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button onClick={send} className="bg-lime-600 px-4 rounded">
          إرسال
        </button>
      </div>
    </div>
  );
}
