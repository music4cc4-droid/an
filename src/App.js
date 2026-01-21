import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { 
  MessageSquare, 
  Settings, 
  User, 
  Search, 
  Send, 
  LogOut, 
  Check, 
  X, 
  Lock, 
  Edit2, 
  MoreVertical,
  ArrowLeft,
  Bell,
  Sparkles,
  Wand2,
  FileText
} from 'lucide-react';

/* --- تهيئة فايربيس --- */
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/* --- تهيئة Gemini API --- */
const apiKey = ""; // يتم حقن المفتاح تلقائياً في البيئة

// دالة مساعدة لاستدعاء Gemini
async function callGemini(prompt) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أستطع توليد النص.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
  }
}

/* --- المكون الرئيسي --- */
export default function OliveChatApp() {
  const [user, setUser] = useState(null); // حالة المصادقة التقنية
  const [appUser, setAppUser] = useState(null); // بيانات المستخدم في التطبيق
  const [view, setView] = useState('login'); // login, register, main
  const [loading, setLoading] = useState(true);

  // تهيئة المصادقة عند البدء
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // التحقق مما إذا كان المستخدم مسجلاً دخولاً في "نظامنا" (اسم المستخدم وكلمة المرور)
  useEffect(() => {
    const savedUserId = localStorage.getItem('olive_chat_uid');
    if (user && savedUserId) {
      const unsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'app_users', savedUserId), (docSnap) => {
        if (docSnap.exists()) {
          setAppUser({ id: docSnap.id, ...docSnap.data() });
          setView('main');
        }
      });
      return () => unsub();
    }
  }, [user]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-zinc-900 text-olive-500">جاري التحميل...</div>;

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-900 font-sans text-gray-100 overflow-hidden sm:flex-row">
      {/* التوجيه بين الشاشات */}
      {view === 'login' && <AuthScreen type="login" setUser={setAppUser} setView={setView} authUser={user} />}
      {view === 'register' && <AuthScreen type="register" setUser={setAppUser} setView={setView} authUser={user} />}
      {view === 'main' && appUser && <MainApp user={user} appUser={appUser} setAppUser={setAppUser} setView={setView} />}
    </div>
  );
}

/* --- شاشة التسجيل والدخول --- */
function AuthScreen({ type, setUser, setView, authUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('يرجى ملء جميع الحقول');
      setLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'all_users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (type === 'login') {
        if (querySnapshot.empty) {
          setError('اسم المستخدم غير موجود');
        } else {
          const userData = querySnapshot.docs[0].data();
          if (userData.password === password) {
            // نجاح الدخول
            localStorage.setItem('olive_chat_uid', querySnapshot.docs[0].id);
            window.location.reload(); 
          } else {
            setError('كلمة المرور غير صحيحة');
          }
        }
      } else {
        // تسجيل جديد
        if (!querySnapshot.empty) {
          setError('اسم المستخدم محجوز مسبقاً');
        } else {
          
          const newUser = {
            username,
            password, 
            bio: 'مستخدم جديد في أوليف شات',
            avatar: Math.floor(Math.random() * 5) + 1, 
            createdAt: serverTimestamp()
          };
          
          const newDocRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'all_users'), newUser);
          
          if (authUser) {
             await setDoc(doc(db, 'artifacts', appId, 'users', authUser.uid, 'app_users', newDocRef.id), newUser);
          }

          localStorage.setItem('olive_chat_uid', newDocRef.id);
          window.location.reload();
        }
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ في الاتصال');
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-800 p-8 shadow-2xl border border-zinc-700">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-lime-900/50 text-lime-400">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Olive Chat</h1>
          <p className="text-zinc-400 text-sm">تواصل بأناقة وخصوصية</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">اسم المستخدم</label>
            <input
              type="text"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-gray-100 outline-none ring-1 ring-zinc-700 focus:ring-2 focus:ring-lime-600 transition-all"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">كلمة المرور</label>
            <input
              type="password"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-gray-100 outline-none ring-1 ring-zinc-700 focus:ring-2 focus:ring-lime-600 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="rounded-lg bg-red-900/20 p-3 text-center text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-lime-700 py-3 font-semibold text-white hover:bg-lime-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'جاري التحميل...' : type === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-400">
          {type === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
          <button
            onClick={() => setView(type === 'login' ? 'register' : 'login')}
            className="mr-2 font-medium text-lime-400 hover:underline"
          >
            {type === 'login' ? 'أنشئ حساباً' : 'سجل الدخول'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- التطبيق الرئيسي --- */
function MainApp({ user, appUser, setAppUser, setView }) {
  const [activeTab, setActiveTab] = useState('chats'); // chats, requests, search, profile, settings
  const [currentChat, setCurrentChat] = useState(null);

  // الخروج
  const handleLogout = () => {
    localStorage.removeItem('olive_chat_uid');
    setView('login');
    window.location.reload();
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* القائمة الجانبية (Sidebar) */}
      <div className={`flex flex-col border-l border-zinc-800 bg-zinc-900 md:w-80 w-full ${currentChat ? 'hidden md:flex' : 'flex'}`}>
        {/* الهيدر الخاص بالقائمة */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-800/50 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Avatar seed={appUser.avatar} size="10" />
            <div>
               <h2 className="text-lg font-bold text-gray-100 leading-tight">{appUser.username}</h2>
               <p className="text-xs text-lime-500">متصل</p>
            </div>
          </div>
          <div className="flex gap-1">
             <button onClick={() => setActiveTab('search')} className={`p-2 rounded-full hover:bg-zinc-700 ${activeTab === 'search' ? 'text-lime-400' : 'text-zinc-400'}`}>
                <Search size={20} />
             </button>
             <button onClick={() => setActiveTab('requests')} className={`p-2 rounded-full hover:bg-zinc-700 ${activeTab === 'requests' ? 'text-lime-400' : 'text-zinc-400'}`}>
                <Bell size={20} />
             </button>
             <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-full hover:bg-zinc-700 ${activeTab === 'settings' ? 'text-lime-400' : 'text-zinc-400'}`}>
                <MoreVertical size={20} />
             </button>
          </div>
        </div>

        {/* محتوى القائمة الجانبية */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'chats' && <ChatList appUser={appUser} onSelectChat={setCurrentChat} />}
          {activeTab === 'search' && <SearchUsers appUser={appUser} />}
          {activeTab === 'requests' && <FriendRequests appUser={appUser} />}
          {activeTab === 'settings' && <SettingsPanel appUser={appUser} setAppUser={setAppUser} onLogout={handleLogout} onBack={() => setActiveTab('chats')} />}
          {activeTab === 'profile' && <ProfileEditor appUser={appUser} setAppUser={setAppUser} onBack={() => setActiveTab('chats')} />}
        </div>

        {/* شريط التنقل السفلي للقائمة */}
        <div className="grid grid-cols-4 border-t border-zinc-800 bg-zinc-900 py-2">
           <NavBtn icon={<MessageSquare />} active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} />
           <NavBtn icon={<Search />} active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
           <NavBtn icon={<User />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
           <NavBtn icon={<Settings />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </div>

      {/* منطقة المحادثة (Main Chat Area) */}
      <div className={`flex-1 flex-col bg-[#111b21] relative ${!currentChat ? 'hidden md:flex' : 'flex'}`}>
        {currentChat ? (
          <ChatWindow 
            chat={currentChat} 
            currentUser={appUser} 
            onBack={() => setCurrentChat(null)} 
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center p-8 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
            <div className="mb-6 rounded-full bg-zinc-800 p-6 text-lime-500 shadow-xl border border-zinc-700">
              <MessageSquare size={48} />
            </div>
            <h2 className="text-2xl font-light text-gray-300">أوليف شات للويب</h2>
            <p className="mt-2 max-w-md text-zinc-500">أرسل واستقبل الرسائل بخصوصية تامة. اختر محادثة للبدء أو ابحث عن أصدقاء جدد.</p>
            <div className="mt-8 border-t border-zinc-800 pt-8 text-xs text-zinc-600 flex items-center gap-2">
              <Lock size={12} />
              مشفرة (محاكاة) من الطرف إلى الطرف
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- المكونات الفرعية --- */

function NavBtn({ icon, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 transition-colors ${active ? 'text-lime-500' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {React.cloneElement(icon, { size: 24 })}
    </button>
  );
}

// قائمة المحادثات
function ChatList({ appUser, onSelectChat }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // جلب قائمة الأصدقاء (التي تمثل المحادثات)
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'friendships'), 
      where('users', 'array-contains', appUser.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatsData);
      setLoading(false);
    });

    return () => unsub();
  }, [appUser.id]);

  if (loading) return <div className="p-4 text-center text-zinc-500 text-sm">جاري تحديث القائمة...</div>;
  if (chats.length === 0) return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-500">
      <p>لا توجد محادثات.</p>
      <p className="text-xs mt-2">ابحث عن أصدقاء عبر أيقونة البحث.</p>
    </div>
  );

  return (
    <div className="divide-y divide-zinc-800/50">
      {chats.map(chat => {
        // تحديد الطرف الآخر في المحادثة
        const otherUser = chat.userDetails.find(u => u.id !== appUser.id) || { username: 'مستخدم', avatar: 1 };
        return (
          <div 
            key={chat.id} 
            onClick={() => onSelectChat({ ...chat, otherUser })}
            className="flex cursor-pointer items-center gap-3 p-4 hover:bg-zinc-800/50 transition-colors"
          >
            <Avatar seed={otherUser.avatar} size="12" />
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-semibold text-gray-200 truncate">{otherUser.username}</h3>
                {chat.lastMessageTime && (
                   <span className="text-[10px] text-zinc-500">
                     {new Date(chat.lastMessageTime?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 truncate">
                {chat.lastMessage || <span className="text-lime-700 italic">انقر لبدء المحادثة</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// نافذة المحادثة
function ChatWindow({ chat, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showMagicMenu, setShowMagicMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const dummyDiv = useRef(null);

  useEffect(() => {
    // جلب الرسائل (آخر 100)
    const msgsRef = collection(db, 'artifacts', appId, 'public', 'data', `chats_${chat.id}_messages`);
    const q = query(msgsRef, orderBy('timestamp', 'asc')); 

    const unsub = onSnapshot(q, (snapshot) => {
      let msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (msgs.length > 100) msgs = msgs.slice(msgs.length - 100);
      setMessages(msgs);
      setTimeout(() => dummyDiv.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsub();
  }, [chat.id]);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;

    const msgText = newMessage;
    setNewMessage('');

    try {
      // 1. إضافة الرسالة
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `chats_${chat.id}_messages`), {
        text: msgText,
        senderId: currentUser.id,
        timestamp: serverTimestamp()
      });

      // 2. تحديث ملخص المحادثة
      const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'friendships', chat.id);
      await updateDoc(chatRef, {
        lastMessage: msgText,
        lastMessageTime: serverTimestamp()
      });

    } catch (err) {
      console.error("Error sending", err);
    }
  };

  /* --- ميزات Gemini AI --- */
  
  // 1. إعادة صياغة الرسالة
  const handleMagicRewrite = async (style) => {
    if (!newMessage.trim()) return;
    setIsGenerating(true);
    setShowMagicMenu(false);
    
    let prompt = "";
    if (style === 'formal') prompt = `أعد صياغة الرسالة التالية لتكون رسمية واحترافية باللغة العربية: "${newMessage}"`;
    if (style === 'friendly') prompt = `أعد صياغة الرسالة التالية لتكون ودودة ولطيفة جداً باللغة العربية (يمكنك إضافة إيموجي): "${newMessage}"`;
    if (style === 'fix') prompt = `قم بتصحيح الأخطاء الإملائية والنحوية في الرسالة التالية فقط دون تغيير المعنى: "${newMessage}"`;

    const result = await callGemini(prompt);
    // إزالة علامات التنصيص إذا أضافها النموذج
    setNewMessage(result.replace(/^"|"$/g, '').trim());
    setIsGenerating(false);
  };

  // 2. تلخيص المحادثة
  const handleSummarizeChat = async () => {
    if (messages.length === 0) return;
    setIsGenerating(true);
    setShowSummary(true);
    
    // نجمع آخر 20 رسالة فقط للسياق
    const recentMessages = messages.slice(-20).map(m => {
       const senderName = m.senderId === currentUser.id ? "أنا" : chat.otherUser.username;
       return `${senderName}: ${m.text}`;
    }).join("\n");

    const prompt = `لخص المحادثة التالية في 3 نقاط رئيسية باللغة العربية. ركز على المعلومات المهمة والقرارات:\n\n${recentMessages}`;
    
    const result = await callGemini(prompt);
    setSummary(result);
    setIsGenerating(false);
  };

  return (
    <div className="flex h-full flex-col bg-[#0b141a] relative">
      {/* نافذة التلخيص */}
      {showSummary && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-800 rounded-xl p-6 shadow-2xl border border-zinc-700">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lime-400 font-bold flex items-center gap-2"><Sparkles size={18}/> ملخص المحادثة</h3>
               <button onClick={() => setShowSummary(false)} className="text-zinc-400 hover:text-white"><X size={20}/></button>
             </div>
             {isGenerating && !summary ? (
               <div className="py-8 text-center text-zinc-400 animate-pulse">جاري تحليل المحادثة بالذكاء الاصطناعي...</div>
             ) : (
               <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{summary}</div>
             )}
             <div className="mt-4 text-xs text-zinc-500 text-center">تم التلخيص بواسطة Gemini AI</div>
          </div>
        </div>
      )}

      {/* رأس المحادثة */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-800 p-3 shadow-md z-10">
        <button onClick={onBack} className="md:hidden text-zinc-400 hover:text-white">
          <ArrowLeft />
        </button>
        <Avatar seed={chat.otherUser.avatar} size="10" />
        <div className="flex-1">
          <h3 className="font-bold text-gray-100">{chat.otherUser.username}</h3>
          <p className="text-xs text-lime-500">{chat.otherUser.bio || 'مشغول'}</p>
        </div>
        <button 
          onClick={handleSummarizeChat}
          title="تلخيص المحادثة"
          className="p-2 text-lime-400 hover:bg-zinc-700 rounded-full transition-colors flex items-center gap-1 text-xs font-bold border border-lime-900/50"
        >
           <FileText size={16} /> 
           <span className="hidden sm:inline">تلخيص</span>
        </button>
      </div>

      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          return (
            <div key={msg.id} className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[75%] px-4 py-2 rounded-lg shadow-sm text-sm break-words relative 
                  ${isMe 
                    ? 'bg-lime-900 text-gray-100 rounded-tl-lg' 
                    : 'bg-zinc-800 text-gray-100 rounded-tr-lg'
                  }`}
              >
                {msg.text}
                <div className={`text-[9px] mt-1 text-right opacity-60 flex justify-end gap-1 ${isMe ? 'text-lime-200' : 'text-zinc-400'}`}>
                   {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                   {isMe && <Check size={12} className="text-lime-400" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={dummyDiv}></div>
      </div>

      {/* حقل الإدخال */}
      <div className="bg-zinc-800 p-3 relative">
        {/* قائمة الخيارات السحرية */}
        {showMagicMenu && (
          <div className="absolute bottom-20 right-4 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 flex flex-col gap-2 min-w-[150px] z-20">
             <button onClick={() => handleMagicRewrite('formal')} className="text-right px-3 py-2 hover:bg-zinc-700 rounded text-sm text-gray-200">رسمي 👔</button>
             <button onClick={() => handleMagicRewrite('friendly')} className="text-right px-3 py-2 hover:bg-zinc-700 rounded text-sm text-gray-200">ودود 😊</button>
             <button onClick={() => handleMagicRewrite('fix')} className="text-right px-3 py-2 hover:bg-zinc-700 rounded text-sm text-gray-200">تصحيح لغوي ✅</button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="اكتب رسالة..." 
              disabled={isGenerating}
              className={`w-full bg-zinc-700 text-white rounded-full pl-4 pr-12 py-3 outline-none focus:ring-1 focus:ring-lime-600 placeholder-zinc-400 ${isGenerating ? 'opacity-50' : ''}`}
            />
            {/* زر العصا السحرية */}
            {newMessage.length > 0 && (
              <button 
                type="button"
                onClick={() => setShowMagicMenu(!showMagicMenu)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-lime-400 hover:text-lime-200 transition-colors"
                title="تحسين النص باستخدام Gemini"
              >
                {isGenerating ? <div className="animate-spin w-4 h-4 border-2 border-lime-500 border-t-transparent rounded-full"></div> : <Wand2 size={18} />}
              </button>
            )}
          </div>
          <button 
            type="submit" 
            disabled={!newMessage.trim() || isGenerating}
            className="p-3 bg-lime-700 rounded-full text-white hover:bg-lime-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

// البحث عن مستخدمين
function SearchUsers({ appUser }) {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!queryText) return;
    setStatus('جاري البحث...');
    
    // ملاحظة: Firestore لا يدعم البحث النصي الكامل بسهولة، لذا سنبحث عن تطابق تام أو مبدئي
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'all_users');
    const q = query(usersRef, where('username', '==', queryText)); // بحث دقيق لليوزر
    
    const snap = await getDocs(q);
    if (snap.empty) {
        setStatus('لم يتم العثور على مستخدم');
        setResults([]);
    } else {
        setStatus('');
        setResults(snap.docs.map(d => ({id: d.id, ...d.data()})).filter(u => u.id !== appUser.id));
    }
  };

  const sendRequest = async (targetUser) => {
    try {
        // التحقق مما إذا كان الطلب موجوداً بالفعل
        const requestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'friend_requests');
        await addDoc(requestsRef, {
            fromId: appUser.id,
            fromName: appUser.username,
            fromAvatar: appUser.avatar,
            toId: targetUser.id,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        setStatus('تم إرسال طلب الصداقة بنجاح');
        setResults([]); // إخفاء النتيجة
        setQueryText('');
    } catch (e) {
        setStatus('حدث خطأ');
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lime-500 font-bold mb-4">إضافة صديق جديد</h3>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input 
          type="text" 
          placeholder="أدخل معرف المستخدم (Username)" 
          className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm border border-zinc-700 outline-none focus:border-lime-600"
          value={queryText}
          onChange={e => setQueryText(e.target.value)}
        />
        <button type="submit" className="bg-lime-800 p-2 rounded text-white"><Search size={18} /></button>
      </form>
      
      {status && <p className="text-xs text-zinc-400 text-center mb-4">{status}</p>}

      <div className="space-y-2">
        {results.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                <div className="flex items-center gap-2">
                    <Avatar seed={u.avatar} size="8" />
                    <div>
                        <p className="text-sm font-bold">{u.username}</p>
                        <p className="text-[10px] text-zinc-400">{u.bio.substring(0, 20)}</p>
                    </div>
                </div>
                <button onClick={() => sendRequest(u)} className="text-lime-400 hover:text-lime-300 text-xs font-bold border border-lime-800 px-3 py-1 rounded-full">
                    إضافة
                </button>
            </div>
        ))}
      </div>
    </div>
  );
}

// طلبات الصداقة
function FriendRequests({ appUser }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'friend_requests'),
        where('toId', '==', appUser.id),
        where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [appUser.id]);

  const handleRequest = async (req, action) => {
    const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'friend_requests', req.id);
    
    if (action === 'reject') {
        await updateDoc(reqRef, { status: 'rejected' });
    } else {
        // إنشاء علاقة صداقة
        await updateDoc(reqRef, { status: 'accepted' });
        
        // إنشاء محادثة جديدة
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'friendships'), {
            users: [req.fromId, req.toId],
            userDetails: [
                { id: req.fromId, username: req.fromName, avatar: req.fromAvatar, bio: '...' },
                { id: appUser.id, username: appUser.username, avatar: appUser.avatar, bio: appUser.bio }
            ],
            lastMessage: 'تمت الموافقة على الطلب',
            lastMessageTime: serverTimestamp()
        });
    }
  };

  return (
    <div className="p-4">
        <h3 className="text-lime-500 font-bold mb-4">طلبات الصداقة</h3>
        {requests.length === 0 && <p className="text-center text-zinc-600 text-sm">لا توجد طلبات معلقة</p>}
        <div className="space-y-2">
            {requests.map(req => (
                <div key={req.id} className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar seed={req.fromAvatar} size="10" />
                        <div>
                            <p className="text-sm font-bold text-gray-200">{req.fromName}</p>
                            <p className="text-xs text-zinc-500">يريد مراسلتك</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleRequest(req, 'accept')} className="flex-1 bg-lime-700 hover:bg-lime-600 text-white py-1 rounded text-xs">قبول</button>
                        <button onClick={() => handleRequest(req, 'reject')} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-1 rounded text-xs">رفض</button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

// الملف الشخصي
function ProfileEditor({ appUser, setAppUser, onBack }) {
  const [bio, setBio] = useState(appUser.bio || '');
  const [avatar, setAvatar] = useState(appUser.avatar || 1);
  const [msg, setMsg] = useState('');

  const saveProfile = async () => {
    if (bio.length > 50) {
        setMsg('البايو يجب أن لا يتجاوز 50 حرفاً');
        return;
    }
    
    try {
        // تحديث في العام
        const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'all_users', appUser.id);
        await updateDoc(publicRef, { bio, avatar });
        
        // تحديث في الخاص
        // لاحظ: في تطبيق حقيقي نحتاج لتحديث بيانات المستخدم في كل المحادثات الموجودة أيضاً
        // للتبسيط هنا نحدث البيانات الأساسية فقط
        
        // تحديث الحالة المحلية
        setAppUser(prev => ({ ...prev, bio, avatar }));
        setMsg('تم الحفظ بنجاح');
        setTimeout(() => setMsg(''), 2000);
    } catch (e) {
        setMsg('فشل الحفظ');
    }
  };

  return (
    <div className="p-4">
        <h3 className="text-lime-500 font-bold mb-6 text-xl">الملف الشخصي</h3>
        
        <div className="flex flex-col items-center mb-6">
            <div className="relative group cursor-pointer" onClick={() => setAvatar(prev => prev >= 5 ? 1 : prev + 1)}>
                <Avatar seed={avatar} size="24" />
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-white">تغيير</span>
                </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">اضغط على الصورة لتغييرها</p>
        </div>

        <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1">الاسم</label>
            <div className="bg-zinc-800 p-3 rounded text-gray-300 border border-zinc-700">{appUser.username}</div>
        </div>

        <div className="mb-6">
            <label className="block text-xs text-zinc-400 mb-1">البايو ({bio.length}/50)</label>
            <input 
                type="text" 
                maxLength={50}
                value={bio} 
                onChange={e => setBio(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-white focus:border-lime-600 outline-none"
            />
        </div>

        {msg && <p className={`text-center text-sm mb-4 ${msg.includes('نجاح') ? 'text-lime-500' : 'text-red-500'}`}>{msg}</p>}

        <button onClick={saveProfile} className="w-full bg-lime-700 text-white py-3 rounded hover:bg-lime-600 font-bold shadow-lg">
            حفظ التغييرات
        </button>
    </div>
  );
}

// الإعدادات
function SettingsPanel({ appUser, onLogout, onBack }) {
    const [newPass, setNewPass] = useState('');
    const [msg, setMsg] = useState('');

    const changePass = async () => {
        if (newPass.length < 4) {
            setMsg('كلمة المرور قصيرة جداً');
            return;
        }
        try {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'all_users', appUser.id);
            await updateDoc(userRef, { password: newPass });
            setMsg('تم تغيير كلمة المرور بنجاح');
            setNewPass('');
        } catch (e) {
            setMsg('خطأ في التحديث');
        }
    };

    return (
        <div className="p-4">
            <h3 className="text-lime-500 font-bold mb-6 text-xl">الإعدادات</h3>
            
            <div className="mb-8">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Lock size={16} className="text-lime-600"/> الأمان والخصوصية
                </h4>
                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                    <label className="block text-xs text-zinc-400 mb-2">تغيير كلمة المرور</label>
                    <div className="flex gap-2">
                        <input 
                            type="password" 
                            placeholder="كلمة مرور جديدة"
                            value={newPass}
                            onChange={e => setNewPass(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                        />
                        <button onClick={changePass} className="bg-zinc-700 hover:bg-lime-700 text-white px-4 rounded text-xs transition-colors">
                            تحديث
                        </button>
                    </div>
                    {msg && <p className="text-xs mt-2 text-lime-400">{msg}</p>}
                </div>
            </div>

            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-red-900/30 text-red-400 border border-red-900/50 py-3 rounded hover:bg-red-900/50 transition-colors">
                <LogOut size={18} />
                تسجيل الخروج
            </button>
            
            <div className="mt-8 text-center">
                <p className="text-xs text-zinc-600">Olive Chat v1.1</p>
                <p className="text-[10px] text-zinc-700 mt-1">مدعوم بـ Gemini AI</p>
            </div>
        </div>
    );
}

// مكون الصورة الرمزية البسيط
function Avatar({ seed, size }) {
  // نستخدم مولد صور عشوائي بناءً على الرقم
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
  const colorClass = colors[(seed || 1) % colors.length];
  
  return (
    <div className={`relative flex items-center justify-center rounded-full overflow-hidden ${colorClass} shrink-0`} style={{ width: `${size * 4}px`, height: `${size * 4}px` }}>
       <span className="text-white font-bold text-lg opacity-80">
         <User size={size * 2} />
       </span>
    </div>
  );
        }
