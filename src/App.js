import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
  remove,
} from "firebase/database";

// ─── PASTE YOUR FIREBASE CONFIG HERE ───────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxFD4ZbOeiVLwpULDtiknSOjkEoaV_nlA",
  authDomain: "mathracer-97d5d.firebaseapp.com",
  databaseURL:
    "https://mathracer-97d5d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mathracer-97d5d",
  storageBucket: "mathracer-97d5d.firebasestorage.app",
  messagingSenderId: "893355859832",
  appId: "1:893355859832:web:2559925565cde54113728d",
};
// ───────────────────────────────────────────────────────────────────────────

let db = null;
try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getDatabase(app);
} catch (e) {}

function generateQuestion() {
  const ops = ["+", "−", "×", "÷"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === "+") { a = Math.floor(Math.random()*90)+10; b = Math.floor(Math.random()*90)+10; answer = a+b; }
  else if (op === "−") { a = Math.floor(Math.random()*90)+10; b = Math.floor(Math.random()*90)+10; if(b>a){let t=a;a=b;b=t;} answer=a-b; }
  else if (op === "×") { a = Math.floor(Math.random()*9)+2; b = Math.floor(Math.random()*9)+2; answer=a*b; }
  else { answer=Math.floor(Math.random()*19)+2; b=Math.floor(Math.random()*9)+2; a=answer*b; }
  return { a, b, op, answer };
}

function generateQuestionSet(n) {
  return Array.from({ length: n }, () => generateQuestion());
}

function generateLobbyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function formatTime(ms) {
  if (!ms && ms !== 0) return "--:--";
  const s = Math.floor(ms / 1000);
  return Math.floor(s/60) + ":" + (s%60).toString().padStart(2,"0");
}

export default function MathRacer() {
  const [screen, setScreen] = useState("home");
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [bestTimes, setBestTimes] = useState({ 10: null, 20: null, 30: null });

  const [question, setQuestion] = useState(null);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [streak, setStreak] = useState(0);

  const [mpMode, setMpMode] = useState("create");
  const [lobbyCode, setLobbyCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [mpQuestions, setMpQuestions] = useState([]);
  const [mpScore, setMpScore] = useState(0);
  const [mpInput, setMpInput] = useState("");
  const [mpFeedback, setMpFeedback] = useState(null);
  const [mpStreak, setMpStreak] = useState(0);
  const [mpStartTime, setMpStartTime] = useState(null);
  const [mpElapsed, setMpElapsed] = useState(null);
  const [mpWrongCount, setMpWrongCount] = useState(0);
  const [lobbyError, setLobbyError] = useState("");
  const [firebaseReady] = useState(!!db);

  const inputRef = useRef(null);
  const mpInputRef = useRef(null);
  const timerRef = useRef(null);
  const mpTimerRef = useRef(null);
  const feedbackRef = useRef(null);
  const mpFeedbackRef = useRef(null);
  const playerIdRef = useRef(null);

  useEffect(() => {
    let id = sessionStorage.getItem("mathracer_pid");
    if (!id) { id = "p_" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("mathracer_pid", id); }
    setPlayerId(id);
    playerIdRef.current = id;
  }, []);

  useEffect(() => {
    if (screen === "game" && !feedback) inputRef.current && inputRef.current.focus();
  }, [screen, question, feedback]);

  useEffect(() => {
    if (screen === "mp_race" && !mpFeedback) mpInputRef.current && mpInputRef.current.focus();
  }, [screen, mpScore, mpFeedback]);

  useEffect(() => {
    if (screen === "game" && startTime) {
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTime), 100);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, startTime]);

  useEffect(() => {
    if (screen === "mp_race" && mpStartTime) {
      mpTimerRef.current = setInterval(() => setMpElapsed(Date.now() - mpStartTime), 100);
    }
    return () => clearInterval(mpTimerRef.current);
  }, [screen, mpStartTime]);

  useEffect(() => {
    if (!lobbyCode || !db) return;
    const lRef = ref(db, "lobbies/" + lobbyCode);
    const unsub = onValue(lRef, function(snap) {
      const data = snap.val();
      if (!data) return;
      setLobby(data);
      if (data.status === "racing" && screen === "mp_lobby") {
        setMpQuestions(data.questions || []);
        setMpScore(0); setMpInput(""); setMpFeedback(null); setMpStreak(0); setMpWrongCount(0);
        setMpStartTime(data.startedAt);
        setScreen("mp_race");
      }
    });
    return () => unsub();
  }, [lobbyCode, screen]);

  function startSolo() {
    setScore(0); setInput(""); setFeedback(null); setElapsed(0);
    setWrongCount(0); setStreak(0);
    setStartTime(Date.now());
    setQuestion(generateQuestion());
    setScreen("game");
  }

  function handleSoloSubmit() {
    if (!question || feedback) return;
    const val = parseInt(input, 10);
    if (isNaN(val)) return;
    if (val === question.answer) {
      setFeedback("correct");
      setStreak(function(s) { return s + 1; });
      clearTimeout(feedbackRef.current);
      feedbackRef.current = setTimeout(function() {
        const next = score + 1;
        if (next >= totalQuestions) {
          clearInterval(timerRef.current);
          const ft = Date.now() - startTime;
          setBestTimes(function(p) {
            const updated = Object.assign({}, p);
            updated[totalQuestions] = p[totalQuestions] === null || ft < p[totalQuestions] ? ft : p[totalQuestions];
            return updated;
          });
          setScore(next); setScreen("result");
        } else {
          setScore(next); setQuestion(generateQuestion()); setInput(""); setFeedback(null);
        }
      }, 300);
    } else {
      setFeedback("wrong");
      setWrongCount(function(w) { return w + 1; });
      setStreak(0);
      clearTimeout(feedbackRef.current);
      feedbackRef.current = setTimeout(function() { setInput(""); setFeedback(null); }, 500);
    }
  }

  async function createLobby() {
    if (!db) { setLobbyError("Firebase not configured yet."); return; }
    if (!playerName.trim()) { setLobbyError("Please enter your name."); return; }
    setLobbyError("");
    const code = generateLobbyCode();
    const pid = playerIdRef.current;
    const players = {};
    players[pid] = { name: playerName.trim(), score: 0, finished: false, finishTime: null };
    await set(ref(db, "lobbies/" + code), { code, status: "waiting", host: pid, totalQuestions, players });
    setLobbyCode(code);
    setScreen("mp_lobby");
  }

  async function joinLobby() {
    if (!db) { setLobbyError("Firebase not configured yet."); return; }
    if (!playerName.trim()) { setLobbyError("Please enter your name."); return; }
    if (!joinInput.trim()) { setLobbyError("Please enter a lobby code."); return; }
    setLobbyError("");
    const code = joinInput.trim().toUpperCase();
    const snap = await get(ref(db, "lobbies/" + code));
    if (!snap.exists()) { setLobbyError("Lobby not found. Check the code and try again."); return; }
    const data = snap.val();
    if (data.status !== "waiting") { setLobbyError("This race has already started."); return; }
    const pid = playerIdRef.current;
    const playerUpdate = {};
    playerUpdate["lobbies/" + code + "/players/" + pid] = { name: playerName.trim(), score: 0, finished: false, finishTime: null };
    await update(ref(db), playerUpdate);
    setLobbyCode(code);
    setTotalQuestions(data.totalQuestions || 20);
    setScreen("mp_lobby");
  }

  async function startMultiplayerRace() {
    if (!db || !lobbyCode) return;
    const questions = generateQuestionSet(totalQuestions);
    await update(ref(db, "lobbies/" + lobbyCode), { status: "racing", questions, startedAt: Date.now() });
  }

  async function handleMpSubmit() {
    if (!mpQuestions.length || mpFeedback || !db) return;
    const val = parseInt(mpInput, 10);
    if (isNaN(val)) return;
    const current = mpQuestions[mpScore];
    if (val === current.answer) {
      setMpFeedback("correct");
      setMpStreak(function(s) { return s + 1; });
      clearTimeout(mpFeedbackRef.current);
      mpFeedbackRef.current = setTimeout(async function() {
        const next = mpScore + 1;
        const pid = playerIdRef.current;
        if (next >= totalQuestions) {
          clearInterval(mpTimerRef.current);
          const ft = Date.now() - mpStartTime;
          setMpElapsed(ft);
          const u = {};
          u["lobbies/" + lobbyCode + "/players/" + pid] = { name: playerName.trim(), score: next, finished: true, finishTime: ft };
          await update(ref(db), u);
          setMpScore(next); setScreen("mp_results");
        } else {
          const u = {};
          u["lobbies/" + lobbyCode + "/players/" + pid + "/score"] = next;
          await update(ref(db), u);
          setMpScore(next); setMpInput(""); setMpFeedback(null);
        }
      }, 300);
    } else {
      setMpFeedback("wrong");
      setMpWrongCount(function(w) { return w + 1; });
      setMpStreak(0);
      clearTimeout(mpFeedbackRef.current);
      mpFeedbackRef.current = setTimeout(function() { setMpInput(""); setMpFeedback(null); }, 500);
    }
  }

  async function leaveLobby() {
    if (db && lobbyCode && playerIdRef.current) {
      await remove(ref(db, "lobbies/" + lobbyCode + "/players/" + playerIdRef.current));
    }
    setLobby(null); setLobbyCode(""); setJoinInput(""); setScreen("home");
  }

  const isHost = lobby && playerId && lobby.host === playerId;
  const players = lobby && lobby.players ? Object.entries(lobby.players) : [];
  const currentMpQ = mpQuestions[mpScore] || null;
  const mpProgress = mpScore / totalQuestions;

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn { 0%{transform:scale(0.94);opacity:0} 60%{transform:scale(1.02)} 100%{transform:scale(1);opacity:1} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
    @keyframes slideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .card { background:#fff; border:1px solid #e8e8e5; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.04); }
    .btn-primary { background:#1a1a1a; color:#fff; border:none; border-radius:10px; padding:12px 28px; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:500; cursor:pointer; transition:background 0.15s,transform 0.1s; }
    .btn-primary:hover { background:#2d2d2d; transform:translateY(-1px); }
    .btn-primary:active { transform:translateY(0); }
    .btn-primary:disabled { background:#ccc; cursor:not-allowed; transform:none; }
    .btn-ghost { background:transparent; color:#6b6b6b; border:1px solid #e0e0dc; border-radius:10px; padding:12px 28px; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:400; cursor:pointer; transition:border-color 0.15s,color 0.15s; }
    .btn-ghost:hover { border-color:#bbb; color:#333; }
    .btn-play { background:#1a1a1a; color:#fff; border:none; border-radius:14px; padding:18px 0; font-family:'DM Sans',sans-serif; font-size:17px; font-weight:600; cursor:pointer; transition:background 0.15s,transform 0.12s,box-shadow 0.15s; width:100%; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 2px 8px rgba(0,0,0,0.10); letter-spacing:-0.01em; }
    .btn-play:hover { background:#2d2d2d; transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,0.13); }
    .btn-play:active { transform:translateY(0); }
    .btn-play:disabled { background:#ccc; cursor:not-allowed; transform:none; }
    .answer-input { background:#f9f9f8; border:1.5px solid #e0e0dc; border-radius:10px; color:#1a1a1a; font-size:1.6rem; font-family:'DM Mono',monospace; font-weight:500; width:140px; text-align:center; padding:12px 0; outline:none; transition:border-color 0.15s,box-shadow 0.15s; -moz-appearance:textfield; }
    .answer-input::-webkit-inner-spin-button,.answer-input::-webkit-outer-spin-button{-webkit-appearance:none;}
    .answer-input:focus { border-color:#1a1a1a; box-shadow:0 0 0 3px rgba(26,26,26,0.08); background:#fff; }
    .answer-input.correct { border-color:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,0.1); background:#f0fdf4; }
    .answer-input.wrong { border-color:#dc2626; box-shadow:0 0 0 3px rgba(220,38,38,0.1); background:#fef2f2; animation:shake 0.3s ease; }
    .text-input { background:#f9f9f8; border:1.5px solid #e0e0dc; border-radius:10px; color:#1a1a1a; font-size:15px; font-family:'DM Sans',sans-serif; font-weight:400; width:100%; padding:11px 14px; outline:none; transition:border-color 0.15s,box-shadow 0.15s; }
    .text-input:focus { border-color:#1a1a1a; box-shadow:0 0 0 3px rgba(26,26,26,0.08); background:#fff; }
    .pill { display:inline-flex; align-items:center; gap:5px; background:#f3f3f1; border:1px solid #e8e8e5; border-radius:20px; padding:4px 12px; font-size:13px; color:#6b6b6b; }
    .progress-track { width:100%; height:6px; background:#f0f0ee; border-radius:3px; overflow:hidden; }
    .progress-fill { height:100%; background:#1a1a1a; border-radius:3px; transition:width 0.4s cubic-bezier(0.34,1.56,0.64,1); }
    .q-option { flex:1; padding:10px 0; border-radius:10px; border:1.5px solid #e0e0dc; background:#fff; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:500; color:#6b6b6b; cursor:pointer; transition:all 0.15s; }
    .q-option:hover { border-color:#aaa; color:#1a1a1a; }
    .q-option.selected { border-color:#1a1a1a; background:#1a1a1a; color:#fff; }
    .tab { flex:1; padding:10px 0; border-radius:10px; border:1.5px solid #e0e0dc; background:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; color:#6b6b6b; cursor:pointer; transition:all 0.15s; }
    .tab.active { border-color:#1a1a1a; background:#1a1a1a; color:#fff; }
    .player-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f0f0ee; }
    .player-row:last-child { border-bottom:none; }
  `;

  function wrap(content) {
    return (
      <div style={{ minHeight:"100vh", background:"#f9f9f8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", padding:20 }}>
        <style>{CSS}</style>
        {content}
      </div>
    );
  }

  if (screen === "home") return wrap(
    <div style={{ width:"min(440px,100%)", animation:"fadeUp 0.4s ease" }}>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#fff", border:"1px solid #e8e8e5", borderRadius:20, padding:"6px 14px", marginBottom:22, fontSize:13, color:"#6b6b6b" }}>
          <span style={{fontSize:16}}>🏁</span> Math practice game
        </div>
        <h1 style={{ fontSize:40, fontWeight:600, color:"#1a1a1a", letterSpacing:"-0.03em", lineHeight:1.1, marginBottom:10 }}>Mathracer</h1>
        <p style={{ color:"#6b6b6b", fontSize:15, lineHeight:1.6 }}>Race solo or challenge your friends in real time.</p>
      </div>
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ fontSize:13, color:"#9b9b9b", marginBottom:10, textAlign:"center" }}>Number of questions</div>
        <div style={{ display:"flex", gap:8 }}>
          {[10,20,30].map(function(n) {
            return <button key={n} className={"q-option" + (totalQuestions===n ? " selected" : "")} onClick={function(){setTotalQuestions(n);}}>{n}</button>;
          })}
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <button className="btn-play" onClick={startSolo}>
          <span style={{ fontSize:20 }}>▶</span> Play Solo
        </button>
      </div>
      <button className="btn-ghost" onClick={function(){ setMpMode("create"); setScreen("mp_setup"); }} style={{ width:"100%", padding:13, fontSize:15, borderRadius:14 }}>
        👥 Multiplayer
      </button>
      {bestTimes[totalQuestions] && (
        <div style={{ textAlign:"center", fontSize:13, color:"#6b6b6b", marginTop:14 }}>
          Personal best ({totalQuestions}q): <span style={{ fontFamily:"'DM Mono',monospace", color:"#1a1a1a", fontWeight:500 }}>{formatTime(bestTimes[totalQuestions])}</span>
        </div>
      )}
    </div>
  );

  if (screen === "game") return wrap(
    <div style={{ width:"min(460px,100%)", animation:"fadeUp 0.3s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <span style={{ fontSize:15, fontWeight:500, color:"#1a1a1a" }}>Mathracer</span>
        <div style={{ display:"flex", gap:8 }}>
          <span className="pill"><span style={{ fontFamily:"'DM Mono',monospace", fontWeight:500, color:"#1a1a1a" }}>{formatTime(elapsed)}</span></span>
          {streak >= 3 && <span className="pill" style={{ color:"#d97706", borderColor:"#fde68a", background:"#fffbeb" }}>🔥 {streak}</span>}
        </div>
      </div>
      <div style={{ marginBottom:6 }}><div className="progress-track"><div className="progress-fill" style={{ width:(score/totalQuestions*100) + "%" }} /></div></div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:24 }}>
        <span style={{ fontSize:12, color:"#9b9b9b" }}>Question {score+1} of {totalQuestions}</span>
        <span style={{ fontSize:12, color:"#9b9b9b" }}>{score} correct</span>
      </div>
      <div className="card" style={{ padding:"40px 32px", textAlign:"center", marginBottom:12 }}>
        <div style={{ fontSize:"clamp(2.2rem,8vw,3rem)", fontFamily:"'DM Mono',monospace", fontWeight:500, color:"#1a1a1a", letterSpacing:"-0.02em", marginBottom:32, animation:"slideIn 0.2s ease" }}>
          {question && question.a} {question && question.op} {question && question.b}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          <span style={{ fontSize:22, color:"#9b9b9b", fontFamily:"'DM Mono',monospace" }}>=</span>
          <input ref={inputRef} className={"answer-input" + (feedback==="correct" ? " correct" : feedback==="wrong" ? " wrong" : "")}
            type="number" value={input} onChange={function(e){setInput(e.target.value);}}
            onKeyDown={function(e){if(e.key==="Enter")handleSoloSubmit();}} disabled={!!feedback} placeholder="?" autoFocus />
          <button className="btn-primary" onClick={handleSoloSubmit} disabled={!!feedback} style={{ padding:"12px 20px", fontSize:14 }}>↵</button>
        </div>
        {feedback && (
          <div style={{ marginTop:20, fontSize:14, fontWeight:500, animation:"slideIn 0.15s ease", color: feedback==="correct" ? "#16a34a" : "#dc2626" }}>
            {feedback === "correct" ? "Correct ✓" : "Not quite, try the next one!"}
          </div>
        )}
      </div>
      {wrongCount > 0 && <div style={{ textAlign:"center", fontSize:12, color:"#b0b0aa" }}>{wrongCount} mistake{wrongCount>1?"s":""} so far</div>}
    </div>
  );

  if (screen === "result") return wrap(
    <div style={{ width:"min(420px,100%)", animation:"popIn 0.4s ease", textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🏁</div>
      <h2 style={{ fontSize:28, fontWeight:600, color:"#1a1a1a", letterSpacing:"-0.03em", marginBottom:6 }}>Race complete!</h2>
      <p style={{ color:"#6b6b6b", fontSize:15, marginBottom:28 }}>You answered all {totalQuestions} questions.</p>
      <div className="card" style={{ padding:24, marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
          {[{label:"Time",value:formatTime(elapsed),mono:true},{label:"Correct",value:(totalQuestions-wrongCount)+"/"+totalQuestions},{label:"Mistakes",value:wrongCount}].map(function(item, i){
            return (
              <div key={item.label} style={{ padding:"16px 12px", borderRight:i<2?"1px solid #f0f0ee":"none", textAlign:"center" }}>
                <div style={{ fontSize:item.mono?22:26, fontWeight:600, color:"#1a1a1a", fontFamily:item.mono?"'DM Mono',monospace":"'DM Sans',sans-serif", letterSpacing:"-0.02em", marginBottom:4 }}>{item.value}</div>
                <div style={{ fontSize:12, color:"#9b9b9b" }}>{item.label}</div>
              </div>
            );
          })}
        </div>
        {bestTimes[totalQuestions] && elapsed <= bestTimes[totalQuestions] && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f0f0ee", fontSize:13, color:"#d97706", fontWeight:500 }}>🏆 New personal best!</div>
        )}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn-primary" onClick={startSolo} style={{ flex:1, padding:13 }}>Race again</button>
        <button className="btn-ghost" onClick={function(){setScreen("home");}} style={{ flex:1, padding:13 }}>Home</button>
      </div>
    </div>
  );

  if (screen === "mp_setup") return wrap(
    <div style={{ width:"min(420px,100%)", animation:"fadeUp 0.4s ease" }}>
      <button className="btn-ghost" onClick={function(){setScreen("home");}} style={{ marginBottom:24, padding:"8px 16px", fontSize:13 }}>← Back</button>
      <h2 style={{ fontSize:26, fontWeight:600, color:"#1a1a1a", letterSpacing:"-0.02em", marginBottom:6 }}>Multiplayer</h2>
      <p style={{ color:"#6b6b6b", fontSize:14, marginBottom:24 }}>Create a lobby and share the code, or join a friend's game.</p>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <button className={"tab" + (mpMode==="create" ? " active" : "")} onClick={function(){setMpMode("create");}}>Create lobby</button>
        <button className={"tab" + (mpMode==="join" ? " active" : "")} onClick={function(){setMpMode("join");}}>Join lobby</button>
      </div>
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:13, color:"#6b6b6b", display:"block", marginBottom:6 }}>Your name</label>
          <input className="text-input" placeholder="Enter your name" value={playerName} onChange={function(e){setPlayerName(e.target.value);}} maxLength={16} />
        </div>
        {mpMode === "join" && (
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:13, color:"#6b6b6b", display:"block", marginBottom:6 }}>Lobby code</label>
            <input className="text-input" placeholder="e.g. XK7QP" value={joinInput} onChange={function(e){setJoinInput(e.target.value.toUpperCase());}} maxLength={5} style={{ fontFamily:"'DM Mono',monospace", letterSpacing:4, fontSize:18, textTransform:"uppercase" }} />
          </div>
        )}
        {mpMode === "create" && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, color:"#9b9b9b", marginBottom:8 }}>Questions</div>
            <div style={{ display:"flex", gap:8 }}>
              {[10,20,30].map(function(n){
                return <button key={n} className={"q-option" + (totalQuestions===n ? " selected" : "")} onClick={function(){setTotalQuestions(n);}}>{n}</button>;
              })}
            </div>
          </div>
        )}
        {lobbyError && <div style={{ fontSize:13, color:"#dc2626", marginBottom:12, padding:"8px 12px", background:"#fef2f2", borderRadius:8 }}>{lobbyError}</div>}
        <button className="btn-primary" style={{ width:"100%", padding:13 }} onClick={mpMode==="create" ? createLobby : joinLobby}>
          {mpMode === "create" ? "Create lobby →" : "Join lobby →"}
        </button>
      </div>
      {!firebaseReady && (
        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12, padding:16, fontSize:13, color:"#92400e", lineHeight:1.7 }}>
          <strong>⚠️ Firebase not configured yet.</strong> Multiplayer won't work until you add your config.
        </div>
      )}
    </div>
  );

  if (screen === "mp_lobby") return wrap(
    <div style={{ width:"min(420px,100%)", animation:"fadeUp 0.4s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:600, color:"#1a1a1a" }}>Lobby</h2>
        <button className="btn-ghost" onClick={leaveLobby} style={{ padding:"7px 14px", fontSize:13 }}>Leave</button>
      </div>
      <div className="card" style={{ padding:20, textAlign:"center", marginBottom:16 }}>
        <div style={{ fontSize:12, color:"#9b9b9b", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Lobby Code</div>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:36, fontWeight:500, letterSpacing:10, color:"#1a1a1a" }}>{lobbyCode}</div>
        <div style={{ fontSize:13, color:"#9b9b9b", marginTop:8 }}>Share this code with your friends</div>
      </div>
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ fontSize:13, color:"#9b9b9b", marginBottom:12 }}>Players ({players.length})</div>
        {players.map(function(entry) {
          const pid = entry[0];
          const p = entry[1];
          return (
            <div key={pid} className="player-row">
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"#f0f0ee", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:500, color:"#6b6b6b" }}>
                  {p.name && p.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize:15, color:"#1a1a1a" }}>{p.name}</span>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {lobby && lobby.host === pid && <span style={{ fontSize:11, color:"#d97706", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"2px 8px" }}>Host</span>}
                {pid === playerIdRef.current && <span style={{ fontSize:11, color:"#6b6b6b" }}>You</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:13, color:"#9b9b9b", marginBottom:12, textAlign:"center", animation:"pulse 2s infinite" }}>
        {isHost ? "Start the race when everyone has joined." : "Waiting for the host to start..."}
      </div>
      {isHost && (
        <button className="btn-play" onClick={startMultiplayerRace}>
          <span style={{ fontSize:20 }}>▶</span> Start Race
        </button>
      )}
    </div>
  );

  if (screen === "mp_race") return wrap(
    <div style={{ width:"min(520px,100%)", animation:"fadeUp 0.3s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <span style={{ fontSize:15, fontWeight:500, color:"#1a1a1a" }}>Mathracer</span>
        <span className="pill">
          <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:500, color:"#1a1a1a" }}>{formatTime(mpElapsed || (mpStartTime ? Date.now()-mpStartTime : 0))}</span>
        </span>
      </div>
      <div className="card" style={{ padding:"12px 16px", marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#9b9b9b", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Live standings</div>
        {players.slice().sort(function(a,b){ return (b[1].score||0)-(a[1].score||0); }).map(function(entry, i) {
          const pid = entry[0];
          const p = entry[1];
          return (
            <div key={pid} style={{ marginBottom: i < players.length-1 ? 8 : 0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:13, color: pid===playerIdRef.current ? "#1a1a1a" : "#6b6b6b", fontWeight: pid===playerIdRef.current ? 500 : 400 }}>
                  {i===0?"🥇 ":i===1?"🥈 ":i===2?"🥉 ":(i+1)+". "}{p.name}{pid===playerIdRef.current?" (you)":""}{p.finished?" ✓":""}
                </span>
                <span style={{ fontSize:13, fontFamily:"'DM Mono',monospace", color:"#1a1a1a" }}>{p.score||0}/{totalQuestions}</span>
              </div>
              <div className="progress-track" style={{ height:4 }}>
                <div className="progress-fill" style={{ width:((p.score||0)/totalQuestions*100)+"%", background: pid===playerIdRef.current ? "#1a1a1a" : "#d1d1cf" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom:5 }}><div className="progress-track"><div className="progress-fill" style={{ width:(mpProgress*100)+"%" }} /></div></div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <span style={{ fontSize:12, color:"#9b9b9b" }}>Question {mpScore+1} of {totalQuestions}</span>
        <span style={{ fontSize:12, color:"#9b9b9b" }}>{mpScore} correct</span>
      </div>
      {currentMpQ && (
        <div className="card" style={{ padding:"36px 32px", textAlign:"center", marginBottom:10 }}>
          <div style={{ fontSize:"clamp(2rem,8vw,2.8rem)", fontFamily:"'DM Mono',monospace", fontWeight:500, color:"#1a1a1a", letterSpacing:"-0.02em", marginBottom:28, animation:"slideIn 0.2s ease" }}>
            {currentMpQ.a} {currentMpQ.op} {currentMpQ.b}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <span style={{ fontSize:22, color:"#9b9b9b", fontFamily:"'DM Mono',monospace" }}>=</span>
            <input ref={mpInputRef} className={"answer-input" + (mpFeedback==="correct" ? " correct" : mpFeedback==="wrong" ? " wrong" : "")}
              type="number" value={mpInput} onChange={function(e){setMpInput(e.target.value);}}
              onKeyDown={function(e){if(e.key==="Enter")handleMpSubmit();}} disabled={!!mpFeedback} placeholder="?" autoFocus />
            <button className="btn-primary" onClick={handleMpSubmit} disabled={!!mpFeedback} style={{ padding:"12px 20px", fontSize:14 }}>↵</button>
          </div>
          {mpFeedback && (
            <div style={{ marginTop:18, fontSize:14, fontWeight:500, animation:"slideIn 0.15s ease", color: mpFeedback==="correct" ? "#16a34a" : "#dc2626" }}>
              {mpFeedback === "correct" ? "Correct ✓" : "Not quite, try the next one!"}
            </div>
          )}
        </div>
      )}
      {mpStreak >= 3 && <div style={{ textAlign:"center", fontSize:13, color:"#d97706", marginTop:8 }}>🔥 {mpStreak} streak</div>}
    </div>
  );

  if (screen === "mp_results") return wrap(
    <div style={{ width:"min(420px,100%)", animation:"popIn 0.4s ease", textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🏁</div>
      <h2 style={{ fontSize:28, fontWeight:600, color:"#1a1a1a", letterSpacing:"-0.03em", marginBottom:6 }}>Race complete!</h2>
      <p style={{ color:"#6b6b6b", fontSize:15, marginBottom:24 }}>
        Your time: <span style={{ fontFamily:"'DM Mono',monospace", color:"#1a1a1a", fontWeight:500 }}>{formatTime(mpElapsed)}</span>
      </p>
      <div className="card" style={{ padding:20, marginBottom:20, textAlign:"left" }}>
        <div style={{ fontSize:13, color:"#9b9b9b", marginBottom:12 }}>Final standings</div>
        {players.slice().sort(function(a,b){
          if (a[1].finished && b[1].finished) return (a[1].finishTime||Infinity)-(b[1].finishTime||Infinity);
          if (a[1].finished) return -1;
          if (b[1].finished) return 1;
          return (b[1].score||0)-(a[1].score||0);
        }).map(function(entry, i) {
          const pid = entry[0];
          const p = entry[1];
          return (
            <div key={pid} className="player-row">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+"."}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:500, color:"#1a1a1a" }}>{p.name}{pid===playerIdRef.current?" (you)":""}</div>
                  <div style={{ fontSize:12, color:"#9b9b9b" }}>{p.score||0}/{totalQuestions} correct</div>
                </div>
              </div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:14, color: p.finished?"#1a1a1a":"#9b9b9b" }}>
                {p.finished ? formatTime(p.finishTime) : "DNF"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn-primary" onClick={function(){setScreen("mp_lobby");}} style={{ flex:1, padding:13 }}>Play again</button>
        <button className="btn-ghost" onClick={leaveLobby} style={{ flex:1, padding:13 }}>Home</button>
      </div>
    </div>
  );

  return null;
}
