import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [results, setResults] = useState({ blue: 0, yellow: 0, total: 0 });
  const [myVote, setMyVote] = useState(null);
  const [pendingChoice, setPendingChoice] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [toast, setToast] = useState("");

  const loadResults = () => request("/results").then(setResults).catch(() => {});
  useEffect(() => { loadResults(); }, []);
  useEffect(() => {
    if (!token) return;
    request("/me/vote", { headers: { Authorization: `Bearer ${token}` } })
      .then(({ choice }) => { setMyVote(choice); if (choice) setShowResults(true); })
      .catch(() => logout());
  }, [token]);

  function logout() {
    localStorage.removeItem("token"); localStorage.removeItem("user");
    setToken(null); setUser(null); setMyVote(null); setShowResults(false);
  }

  function choose(choice) {
    setPendingChoice(choice);
    if (!token) return setAuthOpen(true);
    setConfirmOpen(true);
  }

  async function submitVote() {
    try {
      const data = await request("/me/vote", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ choice: pendingChoice }),
      });
      setMyVote(data.choice); setResults(data.results); setShowResults(true); setConfirmOpen(false);
      setToast(myVote ? "Your vote has been updated." : "Your vote is in.");
      setTimeout(() => setToast(""), 3000);
    } catch (error) { setToast(error.message); }
  }

  const bluePct = results.total ? Math.round((results.blue / results.total) * 100) : 50;
  const yellowPct = results.total ? 100 - bluePct : 50;

  return <main className="app">
    <div className="grain" />
    <header>
      <a className="brand" href="#" aria-label="Blue versus Yellow home"><span /> B / Y</a>
      {user && <div className="user"><span>@{user.name}</span><button onClick={logout}>Log out</button></div>}
    </header>

    <section className="hero">
      <p className="eyebrow">THE FRIENDLY DIVIDE</p>
      <h1>Choose your<br /><em>color.</em></h1>
      <p className="lede">No debates. No maybes. Just one simple choice.</p>
    </section>

    <section className="choices" aria-label="Voting choices">
      <button className={`choice blue ${myVote === "blue" ? "selected" : ""}`} onClick={() => choose("blue")}>
        <span className="orb" /><span className="choice-label">BLUE</span><span className="arrow">↗</span>
        {myVote === "blue" && <span className="your-pick">YOUR PICK</span>}
      </button>
      <div className="versus">VS</div>
      <button className={`choice yellow ${myVote === "yellow" ? "selected" : ""}`} onClick={() => choose("yellow")}>
        <span className="orb" /><span className="choice-label">YELLOW</span><span className="arrow">↗</span>
        {myVote === "yellow" && <span className="your-pick">YOUR PICK</span>}
      </button>
    </section>

    {showResults && <section className="results">
      <div className="result-heading"><span>LIVE RESULT</span><strong>{results.total.toLocaleString()} vote{results.total === 1 ? "" : "s"}</strong></div>
      <div className="result-numbers"><span>{bluePct}% BLUE</span><span>{yellowPct}% YELLOW</span></div>
      <div className="bar"><div className="blue-bar" style={{ width: `${bluePct}%` }} /></div>
      <p>You can change your vote anytime—just choose the other side.</p>
    </section>}

    <footer><span>ONE PERSON. ONE VOTE.</span><button onClick={() => setShowResults((v) => !v)}>{showResults ? "Hide results" : "View results"}</button></footer>

    {authOpen && <AuthModal choice={pendingChoice} onClose={() => setAuthOpen(false)} onSuccess={(data) => {
      localStorage.setItem("token", data.token); localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token); setUser(data.user); setAuthOpen(false); setConfirmOpen(true);
    }} />}

    {confirmOpen && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirmOpen(false)}>
      <div className="modal confirm" role="dialog" aria-modal="true">
        <button className="close" onClick={() => setConfirmOpen(false)}>×</button>
        <span className={`mini-orb ${pendingChoice}`} />
        <p className="eyebrow">{myVote ? "CHANGE YOUR VOTE" : "LOCK IT IN"}</p>
        <h2>{myVote ? `Switch to ${pendingChoice}?` : `Vote ${pendingChoice}?`}</h2>
        <p>{myVote ? `This will replace your ${myVote} vote.` : "You can change your choice later."}</p>
        <button className={`primary ${pendingChoice}`} onClick={submitVote}>Yes, vote {pendingChoice}</button>
        <button className="secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
      </div>
    </div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function AuthModal({ choice, onClose, onSuccess }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { onSuccess(await request(`/auth/${mode}`, { method: "POST", body: JSON.stringify(form) })); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true">
      <button className="close" onClick={onClose}>×</button>
      <p className="eyebrow">ONE QUICK STEP</p>
      <h2>{mode === "login" ? "Welcome back." : "Join the vote."}</h2>
      <p>Sign {mode === "login" ? "in" : "up"} to cast your <strong>{choice}</strong> vote.</p>
      <form onSubmit={submit}>
        <label>Username<input autoFocus autoComplete="username" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="your_name" required /></label>
        <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6+ characters" minLength="6" required /></label>
        {error && <p className="error">{error}</p>}
        <button className={`primary ${choice}`} disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in & continue" : "Create account & continue"}</button>
      </form>
      <button className="switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </div>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
