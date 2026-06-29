import React, { useState, useEffect, useMemo, useRef } from "react";

// 製品版 v1.1：データは「本人だけが見られる非公開」。同じアカウントでログインすればスマホ・PCで同期。
const K_RANKS = "kd_pro_ranks_v1";
const K_STUDENTS = "kd_pro_students_v1";
const K_ATT = "kd_pro_att_v1";
const K_LASTBACKUP = "kd_pro_lastbackup_v1";
const SHARED = false;

// 超越塾流空手道岩槻八八道場の審査基準より（必要回数・試合数は設定で変更可）
const DEFAULT_RANKS = [
  { id: "mukyu", name: "無級（白帯）", color: "#FFFFFF", req: 15, match: 0 },
  { id: "k10", name: "10級", color: "#FFFFFF", req: 15, match: 0 },
  { id: "k9", name: "9級", color: "#FFFFFF", req: 15, match: 0 },
  { id: "k8", name: "8級", color: "#FFFFFF", req: 15, match: 0 },
  { id: "k7", name: "7級", color: "#FFFFFF", req: 30, match: 0 },
  { id: "k6", name: "6級", color: "#F4C430", req: 30, match: 1 },
  { id: "k5", name: "5級", color: "#2D6CDF", req: 30, match: 2 },
  { id: "k4", name: "4級", color: "#2E9E4F", req: 30, match: 3 },
  { id: "k3", name: "3級", color: "#E8772E", req: 30, match: 4 },
  { id: "k2", name: "2級", color: "#7A4FB5", req: 30, match: 5 },
  { id: "k1", name: "1級", color: "#8B5A2B", req: 30, match: 5 },
  { id: "d1", name: "初段", color: "#222222", req: 50, match: 0 },
  { id: "d2", name: "弐段", color: "#222222", req: 100, match: 0 },
  { id: "d3", name: "参段", color: "#222222", req: 100, match: 0 },
  { id: "d4", name: "四段", color: "#222222", req: 100, match: 0 },
  { id: "d5", name: "五段", color: "#222222", req: 0, match: 0 },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toLocaleDateString("en-CA");
const fmtJp = (s) => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${y}年${Number(m)}月${Number(d)}日`; };
const dayAfter = (s) => { const d = new Date(s); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); };
const daysSince = (d) => d ? Math.floor((Date.parse(todayStr()) - Date.parse(d)) / 86400000) : Infinity;
const normDate = (s) => {
  if (!s) return "";
  let t = String(s).trim().replace(/\//g, "-");
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` : t;
};
// カタカナ→ひらがなに揃えて、かな検索を「ひらがな・カタカナ」どちらでも当たるように
const kanaNorm = (s) => String(s || "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).toLowerCase().trim();
const nameMatches = (s, q) => {
  const t = (q || "").trim();
  if (!t) return true;
  if (s.name && s.name.includes(t)) return true;
  if (s.kana && kanaNorm(s.kana).includes(kanaNorm(t))) return true;
  return false;
};

async function loadKey(key, fallback) {
  try {
    const r = await window.storage.get(key, SHARED);
    if (r && r.value) return JSON.parse(r.value);
    return fallback;
  } catch (e) { return fallback; }
}
async function saveKey(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), SHARED); }
  catch (e) { console.error("保存エラー", e); }
}

function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const stripName = (x) => String(x || "").replace(/[（(].*?[）)]/g, "").replace(/\s/g, "").trim();
function findRankByName(ranks, val) {
  if (!val) return null;
  const v = stripName(val);
  return ranks.find((r) => stripName(r.name) === v) ||
    ranks.find((r) => stripName(r.name).startsWith(v) || v.startsWith(stripName(r.name))) || null;
}
function toCSVText(rows) {
  return rows.map((r) => r.map((x) => String(x)).join("\t")).join("\r\n");
}
function parseTable(text) {
  // タブ区切り（Excel/スプレッドシートからの貼り付け）かカンマ区切りかを自動判定
  if (text.indexOf("\t") >= 0) {
    return text.replace(/\r/g, "").split("\n").map((line) => line.split("\t"));
  }
  return parseCSV(text);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [ranks, setRanks] = useState(DEFAULT_RANKS);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});

  const [tab, setTab] = useState("att");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showDate, setShowDate] = useState(false);
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [rosterSort, setRosterSort] = useState("name");
  const [attFilter, setAttFilter] = useState("all");
  const [attSort, setAttSort] = useState("name");
  const [compact, setCompact] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [exportModal, setExportModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState(null);

  const firstOfThisMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA"); };
  const [statStart, setStatStart] = useState(firstOfThisMonth());
  const [statEnd, setStatEnd] = useState(todayStr());
  const [statSearch, setStatSearch] = useState("");
  const [statOpen, setStatOpen] = useState(null);
  const [examDate, setExamDate] = useState(todayStr());
  const [lastBackup, setLastBackup] = useState(null);
  const [backupDismissed, setBackupDismissed] = useState(false);
  const exportRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await loadKey(K_RANKS, null);
      const s = await loadKey(K_STUDENTS, []);
      const a = await loadKey(K_ATT, {});
      if (r && r.length) setRanks(r); else saveKey(K_RANKS, DEFAULT_RANKS);
      setStudents(s);
      setAttendance(a);
      const lb = await loadKey(K_LASTBACKUP, null);
      setLastBackup(lb);
      setLoading(false);
    })();
  }, []);

  const updateRanks = (n) => { setRanks(n); saveKey(K_RANKS, n); };
  const updateStudents = (n) => { setStudents(n); saveKey(K_STUDENTS, n); setImportMsg(""); };
  const updateAttendance = (n) => { setAttendance(n); saveKey(K_ATT, n); };

  const rankById = useMemo(() => { const m = {}; ranks.forEach((r) => (m[r.id] = r)); return m; }, [ranks]);
  const rankIndex = (id) => ranks.findIndex((r) => r.id === id);
  const countSince = (sid, from) => (attendance[sid] || []).filter((d) => d >= (from || "0000")).length;

  const eligibilityOf = (st) => {
    const idx = rankIndex(st.rankId);
    const cur = rankById[st.rankId];
    const hasNext = idx >= 0 && idx < ranks.length - 1;
    const needSess = cur ? cur.req : 0;
    const needMatch = cur ? (cur.match || 0) : 0;
    const haveSess = Math.max(0, countSince(st.id, st.startDate) + (st.adjust || 0));
    const haveMatch = st.matches || 0;
    const sessOK = needSess > 0 && haveSess >= needSess;
    const matchOK = haveMatch >= needMatch;
    const eligible = hasNext && needSess > 0 && sessOK && matchOK;
    return { hasNext, needSess, needMatch, haveSess, haveMatch, sessOK, matchOK, eligible, nextRank: hasNext ? ranks[idx + 1] : null };
  };

  const togglePresent = (sid) => {
    setAttendance((prev) => {
      const dates = prev[sid] || [];
      const nextDates = dates.includes(selectedDate) ? dates.filter((d) => d !== selectedDate) : [...dates, selectedDate].sort();
      const next = { ...prev, [sid]: nextDates };
      saveKey(K_ATT, next);
      return next;
    });
  };
  const adjustMatches = (sid, delta) => {
    setStudents((prev) => {
      const next = prev.map((s) => s.id === sid ? { ...s, matches: Math.max(0, (s.matches || 0) + delta) } : s);
      saveKey(K_STUDENTS, next);
      return next;
    });
  };
  const adjustSessions = (sid, delta) => {
    setStudents((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sid) return s;
        const auto = countSince(s.id, s.startDate);
        let adj = (s.adjust || 0) + delta;
        if (auto + adj < 0) adj = -auto;
        return { ...s, adjust: adj };
      });
      saveKey(K_STUDENTS, next);
      return next;
    });
  };
  const saveStudent = (data) => {
    if (data.id) updateStudents(students.map((s) => s.id === data.id ? { ...s, ...data } : s));
    else updateStudents([...students, {
      id: uid(), name: data.name.trim(), kana: (data.kana || "").trim(), rankId: data.rankId,
      joinDate: data.joinDate || todayStr(), startDate: data.startDate || data.joinDate || todayStr(),
      matches: Number(data.matches) || 0, adjust: Number(data.adjust) || 0,
    }]);
    setEditing(null);
  };
  const promote = (st) => {
    const { nextRank } = eligibilityOf(st);
    if (!nextRank) return;
    updateStudents(students.map((s) => s.id === st.id ? { ...s, rankId: nextRank.id, startDate: todayStr(), adjust: 0 } : s));
    setConfirm(null);
  };
  const removeStudent = (st) => {
    updateStudents(students.filter((s) => s.id !== st.id));
    const a = { ...attendance }; delete a[st.id]; updateAttendance(a);
    setConfirm(null); setEditing(null);
  };
  const applyExamReset = () => {
    const start = dayAfter(examDate);
    updateStudents(students.map((s) => ({ ...s, startDate: start, adjust: 0 })));
    setConfirm(null);
  };

  const datesInRange = (sid) => (attendance[sid] || []).filter((d) => d >= statStart && d <= statEnd).sort();

  const exportBackup = () => {
    const rows = [["名前", "ランク", "現ランク出席回数", "必要回数", "試合出場回数", "必要試合数", "判定", "現級になった日", "出席日"]];
    [...students].sort((a, b) => a.name.localeCompare(b.name, "ja")).forEach((s) => {
      const e = eligibilityOf(s);
      rows.push([s.name, rankById[s.rankId]?.name || "", e.haveSess, e.needSess || "", e.haveMatch, e.needMatch || "",
        e.eligible ? "昇級可能" : "", s.startDate, (attendance[s.id] || []).join(" ")]);
    });
    setExportModal({ title: "バックアップ（控え）", text: toCSVText(rows) }); setCopied(false);
    setLastBackup(todayStr()); saveKey(K_LASTBACKUP, todayStr()); setBackupDismissed(true);
  };
  const exportPeriod = () => {
    const rows = [["集計期間", `${statStart} 〜 ${statEnd}`], [], ["名前", "ランク", "出席回数", "出席した日"]];
    [...students].sort((a, b) => a.name.localeCompare(b.name, "ja")).forEach((s) => {
      const ds = datesInRange(s.id);
      rows.push([s.name, rankById[s.rankId]?.name || "", ds.length, ds.join(" ")]);
    });
    setExportModal({ title: `出席集計 ${statStart}〜${statEnd}`, text: toCSVText(rows) }); setCopied(false);
  };
  const parseImport = () => {
    try {
      const rows = parseTable(importText).filter((r) => r.some((c) => (c || "").trim() !== ""));
      if (rows.length < 1) { setImportMsg("データがありません"); setImportPreview(null); return; }
      const head = rows[0].map((h) => h.replace(/^﻿/, "").trim());
      const keys = ["名前", "氏名", "入会", "試合", "大会", "現在の級", "カウント", "昇級", "ランク", "ふりがな", "フリガナ", "かな", "カナ", "よみ", "読み", "稽古回数", "出席回数"];
      const hasHeader = head.some((h) => keys.some((k) => h.includes(k)));
      let iName = 0, iRank = 1, iJoin = 2, iStart = 3, iMatch = 4, iKana = 5, iAdjust = -1, startRow = 0;
      if (hasHeader) {
        const col = (names) => { for (const n of names) { const i = head.findIndex((h) => h.includes(n)); if (i >= 0) return i; } return -1; };
        iName = col(["名前", "氏名"]); iRank = col(["級", "段", "ランク"]); iJoin = col(["入会"]);
        iStart = col(["現在の級", "カウント", "昇級"]); iMatch = col(["試合", "大会"]);
        iKana = col(["ふりがな", "フリガナ", "かな", "カナ", "よみ", "読み"]);
        iAdjust = col(["稽古回数", "出席回数", "出席数"]); startRow = 1;
      }
      const newOnes = [];
      for (let i = startRow; i < rows.length; i++) {
        const r = rows[i];
        const name = ((iName >= 0 ? r[iName] : "") || "").trim();
        if (!name || name.includes("記入例") || name.startsWith("（例")) continue;
        const rank = findRankByName(ranks, iRank >= 0 ? r[iRank] : "") || ranks[0];
        const join = normDate(iJoin >= 0 ? r[iJoin] : "");
        const start = normDate(iStart >= 0 ? r[iStart] : "") || join || todayStr();
        const matches = iMatch >= 0 ? (parseInt(r[iMatch], 10) || 0) : 0;
        const kana = ((iKana >= 0 ? r[iKana] : "") || "").trim();
        const adjust = iAdjust >= 0 ? (parseInt(r[iAdjust], 10) || 0) : 0;
        newOnes.push({ id: uid(), name, kana, rankId: rank.id, joinDate: join || todayStr(), startDate: start, matches, adjust });
      }
      if (!newOnes.length) { setImportMsg("登録できる行が見つかりませんでした"); setImportPreview(null); return; }
      const existing = new Set(students.map((s) => s.name));
      const dupNames = [...new Set(newOnes.filter((o) => existing.has(o.name)).map((o) => o.name))];
      setImportMsg("");
      setImportPreview({ list: newOnes, dupNames });
    } catch (err) { console.error(err); setImportMsg("読み込みに失敗しました"); setImportPreview(null); }
  };
  const commitImport = () => {
    if (!importPreview) return;
    updateStudents([...students, ...importPreview.list]);
    setImportMsg(`${importPreview.list.length}人を登録しました`);
    setImportText(""); setImportPreview(null); setImportOpen(false);
  };
  const closeImport = () => { setImportOpen(false); setImportPreview(null); };

  const filtered = useMemo(() => {
    let list = [...students];
    if (search.trim()) list = list.filter((s) => nameMatches(s, search));
    list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    return list;
  }, [students, search]);
  const eligibleCount = useMemo(() => students.filter((s) => eligibilityOf(s).eligible).length, [students, attendance, ranks]);
  const presentCount = useMemo(() => students.filter((s) => (attendance[s.id] || []).includes(selectedDate)).length, [students, attendance, selectedDate]);

  const Dot = ({ c }) => (<span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: c, border: "1px solid #b8b8b2", marginRight: 8, verticalAlign: "middle" }} />);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50 text-2xl text-stone-500">読み込み中…</div>;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "sans-serif" }}>
      <header className="bg-stone-900 text-white sticky top-0 z-30 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center font-bold text-3xl">空</div>
          <div className="text-xl font-bold">道場 出席・昇級</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-28">
        {students.length > 0 && (daysSince(lastBackup) >= 30) && !backupDismissed && (
          <div className="mb-4 bg-white border border-stone-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-stone-700">{lastBackup ? `前回のバックアップから${daysSince(lastBackup)}日` : "バックアップがまだありません"}</div>
              <div className="text-sm text-stone-400">ときどき控えを残しておくと安心です</div>
            </div>
            <button onClick={exportBackup} className="px-4 py-2.5 rounded-full bg-stone-900 text-white text-base font-bold whitespace-nowrap">バックアップ</button>
            <button onClick={() => setBackupDismissed(true)} aria-label="閉じる" className="text-stone-300 text-2xl leading-none px-1">×</button>
          </div>
        )}
        {/* 出席 */}
        {tab === "att" && (
          <div>
            <div className="bg-white rounded-3xl shadow p-5 mb-5 text-center">
              <div className="text-lg text-stone-500 mb-1">この日の出席をつけています</div>
              <div className="text-4xl font-extrabold">{fmtJp(selectedDate)}</div>
              <div className="mt-3 text-3xl font-extrabold text-red-600">出席 {presentCount} <span className="text-xl text-stone-400">/ {students.length} 人</span></div>
              <button onClick={() => setShowDate(!showDate)} className="mt-3 text-lg text-stone-500 underline">日付を変える（過去分の入力）</button>
              {showDate && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-2 w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3 text-center" />}
            </div>
            <input type="text" placeholder="名前でさがす" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-2xl px-5 py-4 mb-3" />
            {students.length > 0 && (
              <>
                <div className="flex gap-2 mb-3 text-xl">
                  {[{ k: "all", l: "全員" }, { k: "todo", l: "まだ" }, { k: "done", l: "来た" }].map((f) => (
                    <button key={f.k} onClick={() => setAttFilter(f.k)} className={`flex-1 py-3 rounded-2xl font-bold ${attFilter === f.k ? "bg-red-600 text-white" : "bg-stone-200 text-stone-600"}`}>{f.l}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-4 text-base">
                  <span className="text-stone-400">並べ替え</span>
                  <button onClick={() => setAttSort("name")} className={`px-3 py-1 rounded-full font-bold ${attSort === "name" ? "bg-stone-700 text-white" : "bg-stone-200 text-stone-600"}`}>名前順</button>
                  <button onClick={() => setAttSort("rank")} className={`px-3 py-1 rounded-full font-bold ${attSort === "rank" ? "bg-stone-700 text-white" : "bg-stone-200 text-stone-600"}`}>級順</button>
                  <button onClick={() => setCompact(!compact)} className="ml-auto px-3 py-1 rounded-full font-bold bg-stone-200 text-stone-600">{compact ? "大きく" : "つめて"}</button>
                </div>
              </>
            )}
            {students.length === 0 && <Empty msg="まず「設定」から貼り付けで一括登録するか、「名簿」で生徒を追加してください" />}
            <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-3"}>
              {filtered
                .filter((s) => { const p = (attendance[s.id] || []).includes(selectedDate); return attFilter === "todo" ? !p : attFilter === "done" ? p : true; })
                .sort((a, b) => attSort === "rank" ? (rankIndex(a.rankId) - rankIndex(b.rankId)) : 0)
                .map((s) => {
                  const present = (attendance[s.id] || []).includes(selectedDate);
                  return compact ? (
                    <button key={s.id} onClick={() => togglePresent(s.id)}
                      className={`flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${present ? "bg-red-600 text-white shadow" : "bg-white text-stone-800 shadow"}`}>
                      <span className="text-xl font-bold text-left truncate">{s.name}</span>
                      <span className={`ml-2 shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-2xl font-bold ${present ? "bg-white text-red-600" : "bg-stone-100 text-stone-300"}`}>{present ? "✓" : ""}</span>
                    </button>
                  ) : (
                    <button key={s.id} onClick={() => togglePresent(s.id)}
                      className={`w-full flex items-center justify-between px-6 py-6 rounded-3xl transition-all ${present ? "bg-red-600 text-white shadow-lg" : "bg-white text-stone-800 shadow"}`}>
                      <span className="text-left">
                        <span className="text-3xl font-bold">{s.name}</span>
                        <span className={`block text-lg ${present ? "text-red-100" : "text-stone-400"}`}>{rankById[s.rankId]?.name || ""}</span>
                      </span>
                      <span className={`flex items-center justify-center w-16 h-16 rounded-full text-4xl font-bold ${present ? "bg-white text-red-600" : "bg-stone-100 text-stone-300"}`}>{present ? "✓" : ""}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* 名簿 */}
        {tab === "students" && (
          <div>
            <button onClick={() => setEditing({ rankId: ranks[0]?.id, joinDate: todayStr(), matches: 0 })} className="w-full bg-stone-900 text-white py-5 mb-4 text-2xl font-bold rounded-2xl">＋ 生徒を追加</button>
            <div className="flex gap-3 mb-4 text-2xl">
              <button onClick={() => setOnlyEligible(false)} className={`flex-1 py-3 rounded-2xl font-bold ${!onlyEligible ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600"}`}>全員 {students.length}</button>
              <button onClick={() => setOnlyEligible(true)} className={`flex-1 py-3 rounded-2xl font-bold ${onlyEligible ? "bg-red-600 text-white" : "bg-stone-200 text-stone-600"}`}>昇級できる人 {eligibleCount}</button>
            </div>
            <input type="text" placeholder="名前でさがす" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-2xl px-5 py-3 mb-3" />
            <div className="flex gap-3 mb-4 text-lg">
              <span className="text-stone-400 self-center">並べ替え</span>
              <button onClick={() => setRosterSort("name")} className={`px-4 py-1 rounded-full font-bold ${rosterSort === "name" ? "bg-stone-700 text-white" : "bg-stone-200 text-stone-600"}`}>名前順</button>
              <button onClick={() => setRosterSort("rank")} className={`px-4 py-1 rounded-full font-bold ${rosterSort === "rank" ? "bg-stone-700 text-white" : "bg-stone-200 text-stone-600"}`}>級順</button>
            </div>
            {students.length === 0 && <Empty msg="まだ生徒がいません" />}
            <div className="space-y-4">
              {filtered.filter((s) => (onlyEligible ? eligibilityOf(s).eligible : true)).sort((a, b) => rosterSort === "rank" ? (rankIndex(a.rankId) - rankIndex(b.rankId)) : 0).map((s) => {
                const e = eligibilityOf(s);
                const pct = e.needSess > 0 ? Math.min(100, (e.haveSess / e.needSess) * 100) : 100;
                const beltColor = rankById[s.rankId]?.color || "#FFFFFF";
                const accent = beltColor.toUpperCase() === "#FFFFFF" ? "#D6D3D1" : beltColor;
                return (
                  <div key={s.id} className="bg-white rounded-3xl shadow p-5" style={{ borderLeft: "10px solid " + accent }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-3xl font-bold">{s.name}</div>
                        <div className="text-xl text-stone-500 mt-1"><Dot c={rankById[s.rankId]?.color || "#fff"} />{rankById[s.rankId]?.name || ""}</div>
                      </div>
                      {e.eligible && <span className="bg-red-600 text-white text-xl font-bold px-4 py-2 rounded-full whitespace-nowrap">昇級可能！</span>}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xl text-stone-600">
                        稽古 <span className="text-3xl font-extrabold text-stone-900">{e.haveSess}</span> 回
                        {e.hasNext && e.needSess > 0 ? <> ／ 必要 {e.needSess} 回</> : <span className="text-stone-400">（最高位）</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustSessions(s.id, -1)} className="w-11 h-11 rounded-full bg-stone-200 text-stone-700 text-2xl font-bold">−</button>
                        <button onClick={() => adjustSessions(s.id, 1)} className="w-11 h-11 rounded-full bg-stone-700 text-white text-2xl font-bold">＋</button>
                      </div>
                    </div>
                    <div className="h-4 bg-stone-200 rounded-full overflow-hidden mt-2">
                      <div className={`h-full rounded-full ${e.sessOK ? "bg-red-600" : "bg-stone-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xl text-stone-600">
                        試合 <span className="text-2xl font-extrabold text-stone-900">{e.haveMatch}</span> 回
                        {e.needMatch > 0 ? <span className={e.matchOK ? "text-stone-500" : "text-red-600 font-bold"}> ／ 必要 {e.needMatch} 回</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustMatches(s.id, -1)} className="w-11 h-11 rounded-full bg-stone-200 text-stone-700 text-2xl font-bold">−</button>
                        <button onClick={() => adjustMatches(s.id, 1)} className="w-11 h-11 rounded-full bg-stone-700 text-white text-2xl font-bold">＋</button>
                      </div>
                    </div>
                    {e.hasNext && !e.eligible && (
                      <div className="mt-3 text-lg text-stone-500">
                        {!e.sessOK && <>あと稽古 {e.needSess - e.haveSess} 回</>}
                        {!e.sessOK && !e.matchOK && <> ・ </>}
                        {!e.matchOK && e.needMatch > 0 && <>あと試合 {e.needMatch - e.haveMatch} 回</>}
                      </div>
                    )}
                    <div className="flex gap-3 mt-4">
                      {e.eligible && <button onClick={() => setConfirm({ type: "promote", st: s, msg: `${s.name} さんを「${e.nextRank.name}」へ昇級させますか？\n出席の回数カウントは今日からやり直しになります。` })} className="flex-1 bg-red-600 text-white text-2xl font-bold py-4 rounded-2xl">昇級</button>}
                      <button onClick={() => setEditing({ ...s })} className="flex-1 bg-stone-200 text-stone-700 text-2xl font-bold py-4 rounded-2xl">編集</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 集計 */}
        {tab === "stats" && (
          <div>
            <div className="bg-white rounded-3xl shadow p-5 mb-5">
              <div className="text-lg font-bold text-stone-500 mb-3">期間を選ぶ</div>
              <div className="space-y-3">
                <div><label className="block text-base text-stone-500 mb-1">開始日</label><input type="date" value={statStart} onChange={(e) => setStatStart(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></div>
                <div><label className="block text-base text-stone-500 mb-1">終了日</label><input type="date" value={statEnd} onChange={(e) => setStatEnd(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></div>
              </div>
              <div className="mt-4 text-center text-2xl font-bold">{fmtJp(statStart)} 〜 {fmtJp(statEnd)}</div>
            </div>
            <input type="text" placeholder="名前でさがす" value={statSearch} onChange={(e) => setStatSearch(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-2xl px-5 py-3 mb-4" />
            {students.length === 0 && <Empty msg="生徒が登録されると、ここに期間ごとの出席回数が出ます" />}
            <div className="space-y-3">
              {[...students].filter((s) => (statSearch.trim() ? nameMatches(s, statSearch) : true)).sort((a, b) => a.name.localeCompare(b.name, "ja")).map((s) => {
                const ds = datesInRange(s.id); const open = statOpen === s.id;
                return (
                  <div key={s.id} className="bg-white rounded-3xl shadow p-5">
                    <button onClick={() => setStatOpen(open ? null : s.id)} className="w-full flex items-center justify-between text-left">
                      <span><span className="text-3xl font-bold">{s.name}</span><span className="block text-lg text-stone-400">{rankById[s.rankId]?.name || ""}</span></span>
                      <span className="text-right"><span className="text-4xl font-extrabold text-red-600">{ds.length}</span><span className="text-xl text-stone-500"> 回</span></span>
                    </button>
                    {open && <div className="mt-4 border-t-2 border-stone-100 pt-3">{ds.length === 0 ? <div className="text-lg text-stone-400">この期間の出席はありません</div> : <div className="flex flex-wrap gap-2">{ds.map((d) => <span key={d} className="text-lg bg-stone-100 text-stone-700 rounded-lg px-3 py-1">{fmtJp(d)}</span>)}</div>}</div>}
                  </div>
                );
              })}
            </div>
            {students.length > 0 && <button onClick={exportPeriod} className="mt-5 w-full bg-stone-700 text-white py-4 rounded-2xl text-2xl font-bold">この期間をコピー（貼り付け用）</button>}
          </div>
        )}

        {/* 設定 */}
        {tab === "settings" && (
          <div>
            <h2 className="text-2xl font-bold mb-2">生徒の一括登録</h2>
            <p className="text-lg text-stone-500 mb-3 leading-relaxed">ExcelやGoogleスプレッドシートで「名前・級・入会日・現在の級になった日・試合出場回数」の順にセルを並べて選び、コピーします。下のボタンを押して貼り付け、「登録する」を押すとまとめて登録できます（見出し行は入れても入れなくてもOK）。ふりがなを入れたい場合は、見出し行を付けるか、いちばん最後の列に入れてください。</p>
            <button onClick={() => { setImportMsg(""); setImportOpen(true); }} className="w-full bg-stone-900 text-white py-4 rounded-2xl text-2xl font-bold">貼り付けで一括登録</button>
            {importMsg && <div className="mt-3 text-xl text-center text-red-700 font-bold">{importMsg}</div>}

            <h2 className="text-2xl font-bold mt-8 mb-2">審査日でリセット</h2>
            <p className="text-lg text-stone-500 mb-3 leading-relaxed">審査（2月・6月・10月）が終わったら、その審査日を入れて押すと、全員の出席カウントが「審査日の翌日」から数え直しになります。</p>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3 mb-3" />
            <button onClick={() => setConfirm({ type: "examreset", msg: `${fmtJp(examDate)} を審査日として、全員の出席カウントを翌日からやり直しにします。\n\n⚠ この操作は登録中の全員に適用され、あとから元には戻せません。よろしいですか？\n（昇級した人は、別に「昇級」ボタンで級を上げてください）` })} className="w-full bg-stone-700 text-white py-4 rounded-2xl text-2xl font-bold">この審査日で全員リセット</button>

            <h2 className="text-2xl font-bold mt-8 mb-2">級・段の設定</h2>
            <p className="text-lg text-stone-500 mb-3">「回」＝次に上がるのに必要な稽古回数、「試」＝必要な試合出場回数です。</p>
            <div className="space-y-3">
              {ranks.map((r, i) => (
                <div key={r.id} className="bg-white rounded-2xl shadow p-3 flex items-center gap-2">
                  <div className="flex flex-col">
                    <button disabled={i === 0} onClick={() => { const n = [...ranks];[n[i - 1], n[i]] = [n[i], n[i - 1]]; updateRanks(n); }} className="text-2xl text-stone-400 disabled:opacity-20 px-1">▲</button>
                    <button disabled={i === ranks.length - 1} onClick={() => { const n = [...ranks];[n[i + 1], n[i]] = [n[i], n[i + 1]]; updateRanks(n); }} className="text-2xl text-stone-400 disabled:opacity-20 px-1">▼</button>
                  </div>
                  <Dot c={r.color || "#fff"} />
                  <input value={r.name} onChange={(ev) => updateRanks(ranks.map((x) => x.id === r.id ? { ...x, name: ev.target.value } : x))} className="flex-1 min-w-0 text-xl border-2 border-stone-300 rounded-xl px-2 py-2" />
                  <div className="flex items-center gap-1"><span className="text-base text-stone-400">回</span><input type="number" min="0" value={r.req} onChange={(ev) => updateRanks(ranks.map((x) => x.id === r.id ? { ...x, req: Number(ev.target.value) || 0 } : x))} className="w-14 text-xl border-2 border-stone-300 rounded-xl px-1 py-2 text-center" /></div>
                  <div className="flex items-center gap-1"><span className="text-base text-stone-400">試</span><input type="number" min="0" value={r.match} onChange={(ev) => updateRanks(ranks.map((x) => x.id === r.id ? { ...x, match: Number(ev.target.value) || 0 } : x))} className="w-12 text-xl border-2 border-stone-300 rounded-xl px-1 py-2 text-center" /></div>
                  <button onClick={() => setConfirm({ type: "delRank", rank: r, msg: `「${r.name}」を消しますか？` })} className="text-2xl text-stone-300 px-1">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => updateRanks([...ranks, { id: uid(), name: "新しい級", color: "#FFFFFF", req: 30, match: 0 }])} className="mt-4 w-full border-4 border-dashed border-stone-300 text-stone-500 rounded-2xl py-4 text-2xl font-bold">＋ 級を追加</button>

            <h2 className="text-2xl font-bold mt-8 mb-2">バックアップ</h2>
            <p className="text-lg text-stone-500 mb-3">名簿と出席記録をテキストで表示します。コピーしてスプレッドシートやメモ帳に貼り付けると、控えとして残せます。</p>
            <button onClick={exportBackup} className="w-full bg-stone-700 text-white py-4 rounded-2xl text-2xl font-bold">バックアップをコピー（貼り付け用）</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-stone-900 shadow-lg z-30">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {[{ k: "att", l: "出席" }, { k: "students", l: "名簿" }, { k: "stats", l: "集計" }, { k: "settings", l: "設定" }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`py-4 text-xl font-bold border-t-4 ${tab === t.k ? "border-red-500 text-white" : "border-transparent text-stone-400"}`}>{t.l}</button>
          ))}
        </div>
      </nav>

      {editing && <StudentModal data={editing} ranks={ranks} onClose={() => setEditing(null)} onSave={saveStudent} onDelete={(st) => setConfirm({ type: "delStudent", st, msg: `${st.name} さんを名簿から消しますか？` })} />}

      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md">
            <p className="text-2xl text-stone-800 whitespace-pre-line mb-6 leading-relaxed">{confirm.msg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 py-4 rounded-2xl bg-stone-200 text-stone-700 text-2xl font-bold">やめる</button>
              <button onClick={() => {
                if (confirm.type === "promote") promote(confirm.st);
                else if (confirm.type === "delStudent") removeStudent(confirm.st);
                else if (confirm.type === "delRank") { updateRanks(ranks.filter((x) => x.id !== confirm.rank.id)); setConfirm(null); }
                else if (confirm.type === "examreset") applyExamReset();
              }} className="flex-1 py-4 rounded-2xl bg-red-600 text-white text-2xl font-bold">はい</button>
            </div>
          </div>
        </div>
      )}

      {exportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">{exportModal.title}</h2>
            <p className="text-base text-stone-500 mb-2">「コピー」を押すと枠の中が全選択されます。そのままコピー（パソコンはCtrl＋C、スマホは「コピー」）して、メモ帳やスプレッドシートに貼り付けて保存してください。</p>
            <textarea ref={exportRef} readOnly value={exportModal.text} onFocus={(e) => e.target.select()} className="w-full text-sm border-2 border-stone-300 rounded-xl p-3" style={{ height: "12rem", fontFamily: "monospace" }} />
            <div className="flex gap-3 mt-3">
              <button onClick={() => {
                try { if (exportRef.current) { exportRef.current.focus(); exportRef.current.select(); } } catch (_) {}
                let ok = false;
                try { ok = document.execCommand("copy"); } catch (_) {}
                if (!ok) { try { navigator.clipboard.writeText(exportModal.text); ok = true; } catch (_) {} }
                setCopied(ok);
              }} className="flex-1 py-3 rounded-2xl bg-stone-700 text-white text-xl font-bold">{copied ? "コピーしました" : "コピー"}</button>
              <button onClick={() => setExportModal(null)} className="flex-1 py-3 rounded-2xl bg-stone-200 text-stone-700 text-xl font-bold">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">貼り付けで一括登録</h2>
            <p className="text-base text-stone-500 mb-2">列の順番：名前 / 級 / 入会日 / 現在の級になった日 / 試合出場回数 /（任意）ふりがな。スプレッドシートのセルを選んでコピーし、ここに貼り付けてください（1行に1人）。</p>
            <textarea value={importText} onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }} placeholder={"山田太郎  8級  2024-04-01  2025-10-13  0"} className="w-full text-sm border-2 border-stone-300 rounded-xl p-3" style={{ height: "10rem", fontFamily: "monospace" }} />
            {importPreview && (
              <div className="mt-3 bg-stone-100 rounded-2xl p-4">
                <div className="text-2xl font-bold text-stone-800">{importPreview.list.length}人を登録します</div>
                {importPreview.dupNames.length > 0 && (
                  <div className="mt-2 text-base text-red-700 font-bold leading-relaxed">
                    ※すでに同じ名前がいます：{importPreview.dupNames.join("、")}<br />
                    このまま進めると重複して登録されます。よければ「登録する」を押してください。
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 mt-3">
              {!importPreview
                ? <button onClick={parseImport} className="flex-1 py-3 rounded-2xl bg-stone-700 text-white text-xl font-bold">内容を確認</button>
                : <button onClick={commitImport} className="flex-1 py-3 rounded-2xl bg-stone-900 text-white text-xl font-bold">登録する</button>}
              <button onClick={closeImport} className="flex-1 py-3 rounded-2xl bg-stone-200 text-stone-700 text-xl font-bold">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ msg }) { return <div className="bg-white rounded-3xl shadow p-8 text-center text-stone-400 text-2xl leading-relaxed">{msg}</div>; }

function StudentModal({ data, ranks, onClose, onSave, onDelete }) {
  const [name, setName] = useState(data.name || "");
  const [kana, setKana] = useState(data.kana || "");
  const [rankId, setRankId] = useState(data.rankId || ranks[0]?.id);
  const [joinDate, setJoinDate] = useState(data.joinDate || todayStr());
  const [startDate, setStartDate] = useState(data.startDate || data.joinDate || todayStr());
  const [matches, setMatches] = useState(data.matches != null ? String(data.matches) : "0");
  const [adjust, setAdjust] = useState(data.adjust != null ? String(data.adjust) : "0");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md my-8">
        <h2 className="text-3xl font-bold mb-5">{data.id ? "生徒を編集" : "生徒を追加"}</h2>
        <div className="space-y-4">
          <Field label="名前"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></Field>
          <Field label="ふりがな（任意・「さ」などで探せるように）"><input value={kana} onChange={(e) => setKana(e.target.value)} placeholder="さとう" className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></Field>
          <Field label="今の級・段"><select value={rankId} onChange={(e) => setRankId(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3 bg-white">{ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <Field label="入会日"><input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></Field>
          <Field label="今の級になった日（出席カウント開始日）"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></Field>
          <Field label="試合の出場回数（通算）"><input type="number" min="0" value={matches} onChange={(e) => setMatches(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></Field>
          <Field label="稽古回数の手動調整（移行時の繰越や修正用・通常は0）"><input type="number" value={adjust} onChange={(e) => setAdjust(e.target.value)} className="w-full text-2xl border-2 border-stone-300 rounded-xl px-4 py-3" /></Field>
        </div>
        <div className="flex gap-3 mt-6">
          {data.id && <button onClick={() => onDelete(data)} className="px-4 py-4 rounded-2xl bg-stone-100 text-red-600 text-xl font-bold">削除</button>}
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-stone-200 text-stone-700 text-2xl font-bold">閉じる</button>
          <button onClick={() => name.trim() && onSave({ id: data.id, name, kana, rankId, joinDate, startDate, matches, adjust })} className="flex-1 py-4 rounded-2xl bg-stone-900 text-white text-2xl font-bold">保存</button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }) { return (<div><label className="block text-lg font-bold text-stone-500 mb-1">{label}</label>{children}</div>); }
