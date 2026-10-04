import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LineChart, Line, BarChart, Bar, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import './style.css';

const STORAGE_KEY = 'voice-gym-tracker-sets';
const PLAN_KEY = 'voice-gym-tracker-plan';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const localDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const today = () => localDateStr(new Date());
const dateBefore = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateStr(d);
};
const weekdayFor = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};
const weekStart = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOfWeek);
  return localDateStr(date);
};

function normalizeName(str) {
  if (!str) return '';
  const cleaned = str.trim().replace(/\s+/g, ' ');
  return cleaned.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

const blankForm = () => ({ exercise: '', sets: '', reps: '', weight: '', date: today() });
const defaultPlan = () => ({ exercises: Object.fromEntries(DAYS.map((day) => [day, []])), restDays: ['Sunday'] });

function parseWorkout(sentence) {
  const text = sentence.trim().replace(/\s+/g, ' ');
  const pair = text.match(/\b(\d+)\s*(?:sets?|set)\s*(?:of\s*)?(\d+)\s*(?:reps?|rep)?\b/i) || text.match(/\b(\d+)\s*x\s*(\d+)\b/i);
  const weight = text.match(/\bat\s*(\d+(?:\.\d+)?)(?:\s*(?:kg|kgs|kilograms?))?\b/i) || text.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b/i);
  if (!pair || !weight) return null;
  const exercise = text.slice(0, Math.min(pair.index, weight.index)).replace(/[,:; -]+$/, '').trim();
  return exercise ? { exercise: normalizeName(exercise), sets: pair[1], reps: pair[2], weight: weight[1], date: today() } : null;
}

function demoEntries() {
  const dates = [42, 35, 28, 21, 14, 7, 0];
  const plans = [
    ['Bench Press', [60, 62.5, 65, 67.5, 70, 72.5, 75], 3, 8, dates],
    ['Squat', [80, 85, 90, 92.5, 95, 97.5, 100], 3, 6, dates],
    ['Deadlift', [100, 105, 110, 115, 120, 125], 3, 5, [42, 35, 28, 21, 14, 8]],
    ['Overhead Press', [30, 32.5, 35, 35, 35, 35, 35], 3, 8, dates]
  ];
  return plans.flatMap(([exercise, weights, sets, reps, workoutDates]) =>
    weights.map((weight, index) => ({
      id: `demo-${exercise}-${index}`,
      exercise: normalizeName(exercise),
      sets,
      reps,
      weight,
      date: dateBefore(workoutDates[index])
    }))
  );
}

function App() {
  const [entries, setEntries] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      return raw.map((item) => ({ ...item, exercise: normalizeName(item.exercise) }));
    } catch {
      return [];
    }
  });

  const [plan, setPlan] = useState(() => {
    try {
      const raw = { ...defaultPlan(), ...JSON.parse(localStorage.getItem(PLAN_KEY)) };
      const cleanExercises = Object.fromEntries(
        DAYS.map((day) => [day, (raw.exercises?.[day] || []).map(normalizeName).filter(Boolean)])
      );
      return { ...raw, exercises: cleanExercises };
    } catch {
      return defaultPlan();
    }
  });

  const [draftPlan, setDraftPlan] = useState(() => {
    const p = (() => {
      try {
        const raw = { ...defaultPlan(), ...JSON.parse(localStorage.getItem(PLAN_KEY)) };
        const cleanExercises = Object.fromEntries(
          DAYS.map((day) => [day, (raw.exercises?.[day] || []).map(normalizeName).filter(Boolean)])
        );
        return { ...raw, exercises: cleanExercises };
      } catch {
        return defaultPlan();
      }
    })();
    return {
      exercises: Object.fromEntries(DAYS.map((day) => [day, (p.exercises[day] || []).join(', ')])),
      restDays: [...(p.restDays || [])]
    };
  });

  const [planSavedMsg, setPlanSavedMsg] = useState(false);
  const [view, setView] = useState('dashboard');
  const [logType, setLogType] = useState('voice');
  const [planLogMode, setPlanLogMode] = useState('free');
  const [sentence, setSentence] = useState('');
  const [form, setForm] = useState(blankForm);
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const [listening, setListening] = useState(false);
  const [progressMode, setProgressMode] = useState('single');
  const [metric, setMetric] = useState('max');
  const [range, setRange] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [volumePeriod, setVolumePeriod] = useState('daily');

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)), [entries]);

  const hasUnsavedChanges = useMemo(() => {
    const restDaysChanged = JSON.stringify([...draftPlan.restDays].sort()) !== JSON.stringify([...plan.restDays].sort());
    if (restDaysChanged) return true;
    for (const day of DAYS) {
      const savedStr = (plan.exercises[day] || []).join(', ');
      if ((draftPlan.exercises[day] ?? '') !== savedStr) return true;
    }
    return false;
  }, [draftPlan, plan]);

  const todayDay = weekdayFor(today());
  const todaysPlan = (plan.exercises[todayDay] || []).map(normalizeName);
  const todayIsRest = plan.restDays.includes(todayDay);

  const allExercises = useMemo(() => {
    const loggedMap = new Map();
    for (const entry of entries) {
      const norm = normalizeName(entry.exercise);
      if (norm) loggedMap.set(norm, true);
    }
    const planMap = new Map();
    for (const day of DAYS) {
      for (const ex of plan.exercises[day] || []) {
        const norm = normalizeName(ex);
        if (norm) planMap.set(norm, true);
      }
    }
    const allMap = new Map();
    for (const norm of loggedMap.keys()) {
      allMap.set(norm, { name: norm, hasLogs: true });
    }
    for (const norm of planMap.keys()) {
      if (!allMap.has(norm)) {
        allMap.set(norm, { name: norm, hasLogs: false });
      }
    }
    return Array.from(allMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, plan]);

  useEffect(() => {
    if (!selectedExercise && allExercises.length) {
      setSelectedExercise(allExercises[0].name);
    } else if (selectedExercise && !allExercises.some((e) => e.name === selectedExercise)) {
      setSelectedExercise(allExercises[0]?.name || '');
    }
  }, [allExercises, selectedExercise]);

  const groups = useMemo(
    () =>
      Object.entries(
        entries.reduce((acc, entry) => {
          (acc[entry.date] ||= []).push(entry);
          return acc;
        }, {})
      ).sort(([a], [b]) => b.localeCompare(a)),
    [entries]
  );

  const rangeStart = range === 'all' ? '' : dateBefore(Number(range));
  const filteredEntries = useMemo(() => entries.filter((entry) => !rangeStart || entry.date >= rangeStart), [entries, rangeStart]);

  const singleData = useMemo(() => {
    const normSelected = normalizeName(selectedExercise);
    const chosen = filteredEntries.filter((entry) => normalizeName(entry.exercise) === normSelected);
    const byDate = chosen.reduce((acc, entry) => {
      const item = acc[entry.date] ||= { date: entry.date, max: 0, volume: 0, oneRm: 0 };
      const weight = Number(entry.weight);
      const volume = Number(entry.sets) * Number(entry.reps) * weight;
      item.max = Math.max(item.max, weight);
      item.volume += volume;
      item.oneRm = Math.max(item.oneRm, weight * (1 + Number(entry.reps) / 30));
      return acc;
    }, {});
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEntries, selectedExercise]);

  const workoutData = useMemo(() => {
    const byBucket = filteredEntries.reduce((acc, entry) => {
      const date = volumePeriod === 'weekly' ? weekStart(entry.date) : entry.date;
      acc[date] = (acc[date] || 0) + Number(entry.sets) * Number(entry.reps) * Number(entry.weight);
      return acc;
    }, {});
    return Object.entries(byBucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, volume]) => ({ date, volume }));
  }, [filteredEntries, volumePeriod]);

  const comparisonRows = useMemo(() => {
    return Object.values(
      filteredEntries.reduce((acc, entry) => {
        const norm = normalizeName(entry.exercise);
        const item = acc[norm] ||= { exercise: norm, sessions: {} };
        item.sessions[entry.date] = Math.max(item.sessions[entry.date] || 0, Number(entry.weight));
        return acc;
      }, {})
    ).map((item) => {
      const sessions = Object.entries(item.sessions).sort(([a], [b]) => a.localeCompare(b));
      const first = sessions[0][1];
      const latest = sessions[sessions.length - 1][1];
      return { exercise: item.exercise, first, latest, change: first ? ((latest - first) / first) * 100 : 0 };
    });
  }, [filteredEntries]);

  const stats = useMemo(() => {
    const dateSet = new Set(entries.map((entry) => entry.date));
    const week = weekStart(today());
    const volumeToday = entries.filter((entry) => entry.date === today()).reduce((sum, entry) => sum + Number(entry.sets) * Number(entry.reps) * Number(entry.weight), 0);
    const weekEntries = entries.filter((entry) => entry.date >= week);
    const workoutWeek = new Set(weekEntries.map((entry) => entry.date)).size;
    const plannedWeek = DAYS.filter((day) => !plan.restDays.includes(day) && (plan.exercises[day] || []).length).length;

    let cursor = new Date();
    let streak = 0;
    for (let index = 0; index < 366; index += 1) {
      const key = localDateStr(cursor);
      const day = weekdayFor(key);
      if (!plan.restDays.includes(day)) {
        if (dateSet.has(key)) streak += 1;
        else break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    const workoutsToday = new Set(entries.filter((entry) => entry.date === today()).map((entry) => normalizeName(entry.exercise))).size;

    const [y, m, d] = week.split('-').map(Number);
    const currentWeekMonday = new Date(y, m - 1, d);
    const weekDots = DAYS.map((day, idx) => {
      const itemDate = new Date(y, m - 1, d + idx);
      const dateStr = localDateStr(itemDate);
      const isTrained = dateSet.has(dateStr);
      const isRest = plan.restDays.includes(day);
      return { day, dateStr, isTrained, isRest, letter: day.slice(0, 1) };
    });

    return { workoutsToday, volumeToday, workoutWeek, plannedWeek, streak, weekDots };
  }, [entries, plan]);

  const insights = useMemo(() => {
    const cutoff = dateBefore(30);
    const byExercise = entries.reduce((acc, entry) => {
      const norm = normalizeName(entry.exercise);
      const exercise = acc[norm] ||= { name: norm, sessions: {} };
      const session = exercise.sessions[entry.date] ||= { date: entry.date, max: 0 };
      session.max = Math.max(session.max, Number(entry.weight));
      return acc;
    }, {});
    return Object.values(byExercise)
      .map((exercise) => {
        const sessions = Object.values(exercise.sessions).sort((a, b) => b.date.localeCompare(a.date));
        const recent = sessions.filter((session) => session.date >= cutoff);
        const latest = sessions[0];
        const base = recent[recent.length - 1];
        const percentChange = recent.length >= 2 && base.max ? ((latest.max - base.max) / base.max) * 100 : null;
        const four = sessions.slice(0, 4);
        const plateau = four.length === 4 && latest.max <= four[3].max;
        const [y, m, d] = latest.date.split('-').map(Number);
        const latestDateObj = new Date(y, m - 1, d);
        const diffMs = Date.now() - latestDateObj.getTime();
        return {
          name: exercise.name,
          latest,
          percentChange,
          plateau,
          inactiveDays: Math.max(0, Math.floor(diffMs / 86400000)),
          suggestedWeight: latest.max + 2.5
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const completedToday = new Set(entries.filter((entry) => entry.date === today()).map((entry) => normalizeName(entry.exercise)));

  function parseSentence(value = sentence) {
    const parsed = parseWorkout(value);
    if (!parsed) {
      setVoiceDraft(null);
      setMessage('Try: bench press, 3 sets, 8 reps, 60 kg.');
      return;
    }
    setVoiceDraft(parsed);
    setMessage('Review the parsed set, then save it.');
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage('Speech recognition is not available here. Type your set instead.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => { setListening(true); setMessage('Listening...'); };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setMessage('I could not hear that. Please try again or type your set.'); };
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setTranscript(spoken);
      setSentence(spoken);
      parseSentence(spoken);
    };
    recognition.start();
  }

  function saveEntry(event) {
    event.preventDefault();
    const cleanForm = { ...form, exercise: normalizeName(form.exercise) };
    setEntries([{ ...cleanForm, id: crypto.randomUUID(), sets: Number(cleanForm.sets), reps: Number(cleanForm.reps), weight: Number(cleanForm.weight) }, ...entries]);
    setForm(blankForm());
    setMessage('Set saved to your history.');
  }

  function saveVoiceEntry(event) {
    event.preventDefault();
    const cleanDraft = { ...voiceDraft, exercise: normalizeName(voiceDraft.exercise) };
    setEntries([{ ...cleanDraft, id: crypto.randomUUID(), sets: Number(cleanDraft.sets), reps: Number(cleanDraft.reps), weight: Number(cleanDraft.weight) }, ...entries]);
    setSentence('');
    setTranscript('');
    setVoiceDraft(null);
    setMessage('Set saved to your history.');
  }

  function updateDraftExercise(day, value) {
    setDraftPlan((prev) => ({ ...prev, exercises: { ...prev.exercises, [day]: value } }));
  }

  function toggleDraftRest(day) {
    setDraftPlan((prev) => ({ ...prev, restDays: prev.restDays.includes(day) ? prev.restDays.filter((item) => item !== day) : [...prev.restDays, day] }));
  }

  function handleSavePlan() {
    const cleanExercises = Object.fromEntries(DAYS.map((day) => [day, (draftPlan.exercises[day] || '').split(',').map(normalizeName).filter(Boolean)]));
    const newPlan = { exercises: cleanExercises, restDays: [...draftPlan.restDays] };
    setPlan(newPlan);
    localStorage.setItem(PLAN_KEY, JSON.stringify(newPlan));
    setDraftPlan({ exercises: Object.fromEntries(DAYS.map((day) => [day, (cleanExercises[day] || []).join(', ')])), restDays: [...newPlan.restDays] });
    setPlanSavedMsg(true);
    setTimeout(() => setPlanSavedMsg(false), 2000);
  }

  function choosePlanExercise(exercise) {
    setForm({ ...form, exercise: normalizeName(exercise), date: today() });
  }

  return (
    <main className="app-shell">
      <header>
        <div className="brand"><span className="brand-mark">VG</span><h1>Voice Gym Tracker</h1></div>
      </header>
      <nav className="tab-nav" aria-label="Tracker sections">
        <div className="tab-list four-tabs" role="tablist">
          {[
            ['dashboard', 'Dashboard', 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'],
            ['progress', 'Progress', 'M4 18V6M4 18h16M7 15l4-4 3 2 5-6'],
            ['insights', 'Insights', 'M12 3a7 7 0 0 0-4 12.75V19h8v-3.25A7 7 0 0 0 12 3zM9 22h6'],
            ['plan', 'Plan', 'M4 6h16M4 12h16M4 18h10']
          ].map(([id, label, path]) => (
            <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path}/></svg>
              {label}
            </button>
          ))}
        </div>
      </nav>
      {view === 'dashboard' && (
        <>
          <section className="hero">
            <p className="eyebrow">TRAINING LOG</p>
            <h2>Track every rep.<br /><em>Own your progress.</em></h2>
          </section>
          <section className="stats-row four-stats" aria-label="Training totals">
            <article><span>Exercises done today</span><strong>{stats.workoutsToday}</strong></article>
            <article><span>Volume today <i title="Volume = sets x reps x weight, summed across all sets.">i</i></span><strong>{stats.volumeToday.toLocaleString()} <small>kg</small></strong></article>
            <article><span>Current streak</span><strong>{stats.streak} <small>days</small></strong></article>
            <article className="workout-days-card">
              <span>Workout days this week</span>
              <strong>{stats.workoutWeek} <small>of {stats.plannedWeek}</small></strong>
              <div className="workout-progress-bar"><div className="workout-progress-fill" style={{ width: `${stats.plannedWeek ? Math.min(100, Math.round((stats.workoutWeek / stats.plannedWeek) * 100)) : 0}%` }} /></div>
              <div className="workout-dots" aria-label="Weekly activity dots">
                {stats.weekDots.map((item) => {
                  const statusClass = item.isTrained ? 'filled' : item.isRest ? 'dimmed' : 'outlined';
                  const statusTitle = `${item.day}: ${item.isTrained ? 'Trained' : item.isRest ? 'Rest day' : 'Upcoming/Planned'}`;
                  return <div key={item.day} className="workout-dot-item" title={statusTitle}><span className={`dot ${statusClass}`} /><small>{item.letter}</small></div>;
                })}
              </div>
            </article>
          </section>
          <section className="card log-card">
            <div className="section-heading"><h3>Log a set</h3><span>{logType === 'voice' ? 'Voice log' : 'Manual log'}</span></div>
            <div className="log-switch" role="group" aria-label="Logging mode">
              <button className={logType === 'voice' ? 'active' : ''} onClick={() => setLogType('voice')}>Voice log</button>
              <button className={logType === 'manual' ? 'active' : ''} onClick={() => setLogType('manual')}>Manual log</button>
            </div>
            {logType === 'voice' && (
              <>
                <form className="voice-form" onSubmit={(event) => { event.preventDefault(); parseSentence(); }}>
                  <label className="sentence-label">
                    Workout sentence
                    <span className="sentence-row">
                      <input value={sentence} onChange={(event) => { setSentence(event.target.value); setMessage(''); }} placeholder="bench press, 3 sets, 8 reps, 60 kg" />
                      <button className={`mic-button ${listening ? 'listening' : ''}`} type="button" onClick={startListening} aria-label="Speak your workout">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"/></svg>
                      </button>
                    </span>
                  </label>
                  <button className="parse-button" type="submit">Review set <span>-&gt;</span></button>
                </form>
                {transcript && <p className="transcript-display"><span className="eyebrow">RAW TRANSCRIPT</span>{transcript}</p>}
                {message && <p className="helper" aria-live="polite">{message}</p>}
                {voiceDraft && (
                  <form className="confirmation-card" onSubmit={saveVoiceEntry}>
                    <div className="confirmation-title"><div><p className="eyebrow">PARSED SET</p><h4>Review &amp; edit before saving</h4></div><span>Editable</span></div>
                    <div className="confirmation-fields">
                      <label className="exercise-field">Exercise name<input required value={voiceDraft.exercise} onChange={(e) => setVoiceDraft({ ...voiceDraft, exercise: e.target.value })} /></label>
                      <label>Sets<input required min="1" type="number" value={voiceDraft.sets} onChange={(e) => setVoiceDraft({ ...voiceDraft, sets: e.target.value })} /></label>
                      <label>Reps<input required min="1" type="number" value={voiceDraft.reps} onChange={(e) => setVoiceDraft({ ...voiceDraft, reps: e.target.value })} /></label>
                      <label>Weight (kg)<input required min="0" step="0.5" type="number" value={voiceDraft.weight} onChange={(e) => setVoiceDraft({ ...voiceDraft, weight: e.target.value })} /></label>
                      <label>Date<input required type="date" value={voiceDraft.date} onChange={(e) => setVoiceDraft({ ...voiceDraft, date: e.target.value })} /></label>
                      <button type="submit">Save set <span>-&gt;</span></button>
                    </div>
                  </form>
                )}
              </>
            )}
            {logType === 'manual' && (
              <>
                <div className="log-switch plan-log-switch" role="group" aria-label="Plan mode">
                  <button className={planLogMode === 'plan' ? 'active' : ''} disabled={!todaysPlan.length || todayIsRest} onClick={() => setPlanLogMode('plan')}>Today's plan</button>
                  <button className={planLogMode === 'free' ? 'active' : ''} onClick={() => setPlanLogMode('free')}>Free log</button>
                </div>
                {planLogMode === 'plan' && todaysPlan.length && !todayIsRest && (
                  <div className="today-plan">
                    <p>Tap an exercise to prefill the log. Completed exercises are checked.</p>
                    {todaysPlan.map((exercise) => (
                      <button className={completedToday.has(normalizeName(exercise)) ? 'done' : ''} key={exercise} onClick={() => choosePlanExercise(exercise)}>
                        <span>{completedToday.has(normalizeName(exercise)) ? '✓' : ''}</span>
                        {exercise}
                      </button>
                    ))}
                  </div>
                )}
                {planLogMode === 'plan' && (!todaysPlan.length || todayIsRest) && <p className="no-plan">No training plan for today. Free log is ready when you are.</p>}
                {message && <p className="helper" aria-live="polite">{message}</p>}
                <form className="confirmation-card manual-form" onSubmit={saveEntry}>
                  <div className="confirmation-title"><div><p className="eyebrow">MANUAL SET DETAILS</p><h4>Enter or adjust your set</h4></div><span>Required</span></div>
                  <div className="confirmation-fields">
                    <label className="exercise-field">Exercise name<input required value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })} /></label>
                    <label>Sets<input required min="1" type="number" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} /></label>
                    <label>Reps<input required min="1" type="number" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} /></label>
                    <label>Weight (kg)<input required min="0" step="0.5" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></label>
                    <label>Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                    <button type="submit">Save set <span>-&gt;</span></button>
                  </div>
                </form>
              </>
            )}
          </section>
          <div className="data-actions">
            <button onClick={() => { setEntries(demoEntries()); setView('insights'); }}>Load demo data</button>
            <button onClick={() => setEntries([])} disabled={!entries.length}>Clear data</button>
          </div>
          <section className="content-section">
            <div className="section-heading"><h3>History</h3><span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></div>
            {groups.length ? (
              <div className="history-groups">
                {groups.map(([date, items]) => {
                  const [y, m, d] = date.split('-').map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  const dateLabel = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div className="date-group" key={date}>
                      <time dateTime={date}>{dateLabel}</time>
                      {items.map((entry) => (
                        <article className="entry" key={entry.id}>
                          <strong>{entry.exercise}</strong>
                          <span>{entry.sets} sets x {entry.reps} reps</span>
                          <b>{entry.weight} <small>kg</small></b>
                          <button onClick={() => setEntries(entries.filter((item) => item.id !== entry.id))}>Delete</button>
                        </article>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty"><span>o</span><p>No sets logged yet.</p><small>Log a set or load demo data to get started.</small></div>
            )}
          </section>
        </>
      )}
      {view === 'progress' && (
        <section className="content-section progress-section">
          <div className="section-heading"><h3>Progress</h3><span>Choose a view and date range</span></div>
          <div className="progress-controls">
            <div className="control-group">
              <button className={progressMode === 'single' ? 'active' : ''} onClick={() => setProgressMode('single')}>Single exercise</button>
              <button className={progressMode === 'workout' ? 'active' : ''} onClick={() => setProgressMode('workout')}>Whole workout</button>
            </div>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          {progressMode === 'single' ? (
            <>
              <div className="progress-controls secondary">
                <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} disabled={!allExercises.length}>
                  <option value="">Choose exercise</option>
                  {allExercises.map(({ name, hasLogs }) => (
                    <option key={name} value={name}>
                      {hasLogs ? name : `${name} (No data yet)`}
                    </option>
                  ))}
                </select>
                <div className="control-group metric-toggle">
                  {[
                    ['max', 'Max weight'],
                    ['volume', 'Volume'],
                    ['oneRm', 'Estimated 1RM']
                  ].map(([id, label]) => (
                    <button key={id} className={metric === id ? 'active' : ''} onClick={() => setMetric(id)}>{label}</button>
                  ))}
                </div>
              </div>
              {singleData.length ? (
                <div className="chart-card">
                  <ResponsiveContainer width="100%" height={310}>
                    <LineChart data={singleData}>
                      <CartesianGrid stroke="#2a2d33" vertical={false} />
                      <XAxis dataKey="date" stroke="#8a909b" tickLine={false} axisLine={false} />
                      <YAxis stroke="#8a909b" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#1c1e23', border: '1px solid #373a41', borderRadius: 8 }} />
                      <Line type="monotone" dataKey={metric} name={metric === 'oneRm' ? 'Estimated 1RM (kg)' : metric === 'max' ? 'Max weight (kg)' : 'Volume (kg)'} stroke="#b7ff4a" strokeWidth={3} dot={{ fill: '#b7ff4a', strokeWidth: 0, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty">
                  <span>~</span>
                  <p>{range !== 'all' ? 'No logs in this range, try All time.' : `No logs recorded yet for ${selectedExercise || 'this exercise'}.`}</p>
                  {range !== 'all' ? (
                    <button className="switch-range-btn" onClick={() => setRange('all')}>
                      Switch to All time
                    </button>
                  ) : (
                    <small>Log this exercise in the Dashboard tab.</small>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="progress-controls secondary">
                <div className="control-group">
                  <button className={volumePeriod === 'daily' ? 'active' : ''} onClick={() => setVolumePeriod('daily')}>Daily</button>
                  <button className={volumePeriod === 'weekly' ? 'active' : ''} onClick={() => setVolumePeriod('weekly')}>Weekly</button>
                </div>
              </div>
              {workoutData.length ? (
                <>
                  <div className="chart-card">
                    <ResponsiveContainer width="100%" height={310}>
                      <BarChart data={workoutData}>
                        <CartesianGrid stroke="#2a2d33" vertical={false} />
                        <XAxis dataKey="date" stroke="#8a909b" tickLine={false} axisLine={false} />
                        <YAxis stroke="#8a909b" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: '#1c1e23', border: '1px solid #373a41', borderRadius: 8 }} />
                        <Bar dataKey="volume" name="Volume (kg)" fill="#b7ff4a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="comparison-table">
                    <div className="table-row table-head"><span>Exercise</span><span>First</span><span>Latest</span><span>Change</span></div>
                    {comparisonRows.map((row) => (
                      <div className="table-row" key={row.exercise}>
                        <strong>{row.exercise}</strong>
                        <span>{row.first} kg</span>
                        <span>{row.latest} kg</span>
                        <b className={row.change >= 0 ? 'positive' : ''}>{row.change >= 0 ? '+' : ''}{row.change.toFixed(1)}%</b>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty">
                  <span>~</span>
                  <p>{range !== 'all' ? 'No logs in this range, try All time.' : 'No workout data logged yet.'}</p>
                  {range !== 'all' ? (
                    <button className="switch-range-btn" onClick={() => setRange('all')}>
                      Switch to All time
                    </button>
                  ) : (
                    <small>Log a set to view whole workout volume.</small>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {view === 'insights' && (
        <section className="content-section insights-section">
          <div className="section-heading"><h3>Insights</h3><span>Simple training rules</span></div>
          {insights.length ? (
            <div className="insights-list">
              {insights.map((insight) => (
                <article className="insight-card" key={insight.name}>
                  <div className="insight-top">
                    <div>
                      <p className="eyebrow">{insight.latest.date}</p>
                      <h4>{insight.name}</h4>
                    </div>
                    <b>{insight.percentChange === null ? 'Need data' : `${insight.percentChange > 0 ? '+' : ''}${insight.percentChange.toFixed(1)}%`}</b>
                  </div>
                  <p className="insight-label">Max-weight change in the last 30 days</p>
                  <div className="insight-details">
                    <p>Next session <strong>{insight.suggestedWeight.toFixed(1)} kg</strong><small>Last max + 2.5 kg</small></p>
                    {insight.plateau && <p className="warning">Plateau: max weight has not increased in your last 4 sessions.</p>}
                    {insight.inactiveDays >= 7 && <p className="inactive">Not trained for {insight.inactiveDays} days.</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty"><span>~</span><p>No insights yet.</p><small>Log a few sets or load demo data to reveal patterns.</small></div>
          )}
        </section>
      )}
      {view === 'plan' && (
        <section className="content-section plan-section">
          <div className="section-heading"><h3>Workout plan</h3><span>Saved on this device</span></div>
          <p className="plan-intro">Assign comma-separated exercises to each day, or mark a rest day. Sunday starts as a rest day.</p>
          <div className="plan-grid">
            {DAYS.map((day) => (
              <article className={draftPlan.restDays.includes(day) ? 'plan-day rest' : 'plan-day'} key={day}>
                <div>
                  <h4>{day}</h4>
                  <label className="rest-toggle">
                    <input type="checkbox" checked={draftPlan.restDays.includes(day)} onChange={() => toggleDraftRest(day)} /> Rest day
                  </label>
                </div>
                <input
                  disabled={draftPlan.restDays.includes(day)}
                  value={draftPlan.exercises[day] ?? ''}
                  onChange={(e) => updateDraftExercise(day, e.target.value)}
                  placeholder="e.g. Bench Press, Incline Press"
                />
              </article>
            ))}
          </div>
          <div className="plan-actions">
            {hasUnsavedChanges && <span className="unsaved-badge">● Unsaved changes</span>}
            {planSavedMsg && <span className="save-success-msg">Plan saved ✓</span>}
            <button className="save-plan-button" disabled={!hasUnsavedChanges} onClick={handleSavePlan}>Save plan</button>
          </div>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
