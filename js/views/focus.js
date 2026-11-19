/* Focus — one task, one clock, nothing else. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const state = {
    taskId: null,
    mode: "focus",       // focus | pomodoro
    phase: "work",       // work | break (pomodoro only)
    running: false,
    startedAt: null,
    elapsed: 0,          // seconds banked before the current run
    ticker: null,
  };

  const workLength = () => Math.max(5, Number(store.get().settings.focusLength) || 25) * 60;
  const breakLength = () => 5 * 60;

  function currentSeconds() {
    return state.elapsed + (state.running ? (Date.now() - state.startedAt) / 1000 : 0);
  }

  function targetSeconds() {
    if (state.mode === "pomodoro") return state.phase === "work" ? workLength() : breakLength();
    const t = state.taskId ? store.task(state.taskId) : null;
    return Math.max(5, (t && t.duration) || 25) * 60;
  }

  function fmtClock(total) {
    const s = Math.max(0, Math.floor(total));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function displaySeconds() {
    if (state.mode === "pomodoro") return Math.max(0, targetSeconds() - currentSeconds());
    return currentSeconds();
  }

  function ensureTicker() {
    clearInterval(state.ticker);
    state.ticker = setInterval(() => {
      const clock = document.getElementById("focus-clock");
      if (!clock) return;
      const shown = state.mode === "pomodoro" ? displaySeconds() : currentSeconds();
      clock.textContent = fmtClock(shown);
      updateVisuals();
      if (state.running && state.mode === "pomodoro" && displaySeconds() <= 0) completePhase();
    }, 250);
  }

  function updateVisuals() {
    const ring = document.getElementById("focus-ring");
    const fill = document.getElementById("focus-progress");
    const clock = document.getElementById("focus-clock");
    if (!ring || !fill) return;
    const target = targetSeconds();
    const done = U.clamp(currentSeconds() / target, 0, 1);
    const len = 2 * Math.PI * 118;
    fill.style.strokeDasharray = String(len);
    fill.style.strokeDashoffset = String(len * (1 - done));
    if (clock) clock.textContent = fmtClock(state.mode === "pomodoro" ? displaySeconds() : currentSeconds());
    ring.dataset.running = state.running ? "1" : "0";
  }

  function stopTicker() {
    clearInterval(state.ticker);
    state.ticker = null;
  }

  function resetTimer() {
    state.running = false;
    state.startedAt = null;
    state.elapsed = 0;
    state.phase = "work";
    stopTicker();
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.startedAt = Date.now();
    ensureTicker();
    updateVisuals();
    const main = document.getElementById("main");
    if (main) {
      const btn = main.querySelector("#f-start");
      if (btn) btn.innerHTML = `${icon("pause")} Pause`;
    }
  }

  function pause() {
    if (!state.running) return;
    state.elapsed = currentSeconds();
    state.running = false;
    state.startedAt = null;
    stopTicker();
    updateVisuals();
    const main = document.getElementById("main");
    if (main) {
      const btn = main.querySelector("#f-start");
      if (btn) btn.innerHTML = `${icon("play")} Resume`;
    }
  }

  function logSession(minutes) {
    if (minutes < 1) return;
    store.actions.addFocusSession({ taskId: state.taskId, date: U.todayISO(), minutes, mode: state.mode });
  }

  function markDoneAffectsTask() {
    const box = document.getElementById("f-complete-task");
    return box ? box.checked : false;
  }

  function finish() {
    const seconds = currentSeconds();
    const minutes = Math.round(seconds / 60);
    const shouldComplete = markDoneAffectsTask();
    if (state.mode === "pomodoro" && state.phase === "break") {
      resetTimer();
      ui.toast("Break ended. Back to it when you are ready.");
      renderSelf();
      return;
    }
    state.elapsed = seconds;
    state.running = false;
    state.startedAt = null;
    stopTicker();
    if (minutes >= 1) {
      logSession(minutes);
      ui.toast(`${minutes} minute${minutes === 1 ? "" : "s"} logged for this task.`);
    } else if (seconds > 5) {
      ui.toast("Less than a minute. Nothing was logged.");
    }
    if (shouldComplete && state.taskId) {
      const t = store.task(state.taskId);
      if (t && !t.done) store.actions.updateTask(t.id, { done: true });
    }
    resetTimer();
    renderSelf();
  }

  function completePhase() {
    state.running = false;
    state.elapsed = 0;
    state.startedAt = null;
    stopTicker();
    if (state.phase === "work") {
      logSession(Math.round(workLength() / 60));
      state.phase = "break";
      ui.toast(`Pomodoro complete — ${Math.round(workLength() / 60)} minutes logged. Take five.`, {
        action: { label: "Skip break", onClick: () => { state.phase = "work"; renderSelf(); } },
      });
    } else {
      state.phase = "work";
      ui.toast("Break is over. The next block is ready.");
    }
    renderSelf();
  }

  function renderSelf() {
    const main = document.getElementById("main");
    if (main && location.hash.startsWith("#/focus")) render(main, routeParams());
  }

  function routeParams() {
    const q = location.hash.split("?")[1] || "";
    const out = {};
    q.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k) out[k] = decodeURIComponent(v || "");
    });
    return out;
  }

  function candidateTasks() {
    return store.openTasks()
      .sort((a, b) => {
        const aLate = a.date < U.todayISO() ? 0 : 1;
        const bLate = b.date < U.todayISO() ? 0 : 1;
        if (aLate !== bLate) return aLate - bLate;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.date.localeCompare(b.date);
      });
  }

  function chooser() {
    const list = candidateTasks();
    ui.modal({
      title: "Choose your focus",
      sub: "One task at a time. This is the point.",
      body: `
        <div class="rows" style="border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden">
          ${list.length ? list.slice(0, 12).map((t) => {
            const p = t.projectId ? store.project(t.projectId) : null;
            return `<button class="row-item" data-pick="${t.id}" style="width:100%">
              <div class="grow">
                <div class="row-title">${esc(t.title)}</div>
                <div class="row-meta">
                  <span>${p ? esc(p.name) : "Personal"}</span><span class="sep">·</span>
                  <span class="mono">${U.fmtDur(t.duration)}</span><span class="sep">·</span>
                  <span class="${t.date < U.todayISO() ? "danger" : ""}">${U.relDate(t.date)}</span>
                </div>
              </div>
              ${icon("arrow-right", "ico-sm")}
            </button>`;
          }).join("") : `<div class="empty"><p>Every task is done. Choose rest.</p></div>`}
        </div>`,
      onMount: (el, close) => {
        el.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
          close();
          resetTimer();
          location.hash = "#/focus?task=" + b.dataset.pick;
        }));
      },
    });
  }

  function sessionList(taskId) {
    const st = store.get();
    const mine = st.focusSessions.filter((s) => s.taskId === taskId);
    const today = mine.filter((s) => s.date === U.todayISO());
    const total = today.reduce((n, s) => n + s.minutes, 0);
    return { mine, today, total };
  }

  function render(main, params = {}) {
    const st = store.get();
    const requested = params.task || state.taskId;
    const task = requested ? store.task(requested) : null;
    if (requested !== state.taskId) {
      state.taskId = requested || null;
      resetTimer();
    }
    if (!task) {
      state.taskId = null;
      main.innerHTML = `
        <div class="page is-condensed focus-page">
          <div class="focus-empty">
            <span class="focus-empty-mark">${icon("focus", "ico-lg")}</span>
            <h1 class="serif">Choose one thing.</h1>
            <p>Focus mode needs a single task. Pick one from the list, or start from today's priorities.</p>
            <div class="row gap-2 wrap" style="justify-content:center">
              <button class="btn btn-primary" id="f-choose">${icon("list")} Choose a task</button>
              <a class="btn" href="#/today">${icon("today")} Today</a>
            </div>
            <div class="focus-candidates">
              ${candidateTasks().slice(0, 3).map((t) => `
                <a class="focus-candidate" href="#/focus?task=${t.id}">
                  <span class="grow"><span class="focus-candidate-title">${esc(t.title)}</span>
                  <span class="row-meta">${U.fmtDur(t.duration)} · ${t.projectId ? esc(store.project(t.projectId).name) : "Personal"}</span></span>
                  ${icon("arrow-right", "ico-sm")}
                </a>`).join("")}
            </div>
          </div>
        </div>`;
      main.querySelector("#f-choose").addEventListener("click", chooser);
      return;
    }

    const project = task.projectId ? store.project(task.projectId) : null;
    const sessions = sessionList(task.id);
    const otherProjects = store.activeProjects().filter((p) => p.id !== task.projectId).slice(0, 2);
    const todayFocus = store.focusMinutes(U.todayISO());
    const shown = state.mode === "pomodoro" ? displaySeconds() : currentSeconds();
    const done = U.clamp(currentSeconds() / targetSeconds(), 0, 1);
    const len = 2 * Math.PI * 118;

    main.innerHTML = `
      <div class="page focus-page" data-tone="${project ? project.color : "cobalt"}">
        <div class="focus-top">
          <a class="btn btn-ghost btn-sm" href="#/today">${icon("arrow-left")} Leave focus</a>
          <span class="mono focus-mode-label">${state.mode === "pomodoro"
            ? (state.phase === "break" ? "BREAK" : "POMODORO")
            : "FOCUS SESSION"}</span>
          <button class="btn btn-ghost btn-sm" id="f-change">${icon("rotate")} Change task</button>
        </div>

        <div class="focus-stage">
          <div class="focus-task-block">
            <div class="focus-task-meta">
              <span class="pdot" style="--tone:${project ? "var(--p-" + project.color + ")" : "var(--accent)"}"></span>
              <span>${project ? esc(project.name) : "Personal"}</span>
              <span class="sep">/</span>
              <span class="mono">${U.fmtDur(task.duration)} estimated</span>
              ${task.priority === 1 ? '<span class="tag tag-warning" style="height:19px">Priority</span>' : ""}
            </div>
            <h1 class="focus-title">${esc(task.title)}</h1>
            <p class="focus-desc">${task.notes ? esc(task.notes) : "No notes. The task is the whole instruction."}</p>
            <div class="row gap-2 wrap focus-task-actions">
              <button class="btn btn-sm" data-act="open-task" data-id="${task.id}">${icon("edit")} Edit task</button>
              <a class="btn btn-sm btn-ghost" href="${project ? "#/project/" + project.id : "#/tasks"}">${icon(project ? "folder" : "tasks")} ${project ? "Project" : "All tasks"}</a>
              ${task.done
                ? `<span class="tag tag-outline tag-mono">${icon("check", "ico-sm")} Completed</span>`
                : task.date < U.todayISO()
                  ? `<span class="tag tag-danger tag-mono">${Math.abs(U.diffDays(task.date, U.todayISO()))} DAYS BEHIND</span>`
                  : ""}
            </div>
          </div>

          <div class="focus-timer-block">
            <div class="focus-ring" id="focus-ring" data-running="${state.running ? "1" : "0"}">
              <svg viewBox="0 0 260 260" aria-hidden="true">
                <circle cx="130" cy="130" r="118" class="ring-track" />
                <circle cx="130" cy="130" r="118" class="ring-fill" id="focus-progress"
                  style="stroke-dasharray:${len};stroke-dashoffset:${len * (1 - done)}" />
              </svg>
              <div class="focus-clock-wrap">
                <div class="focus-clock mono" id="focus-clock">${fmtClock(shown)}</div>
                <div class="focus-clock-sub mono">${state.mode === "pomodoro"
                  ? (state.phase === "break" ? "break · five minutes" : "remaining")
                  : "target · " + U.fmtDur(Math.round(targetSeconds() / 60))}</div>
              </div>
            </div>

            <div class="focus-controls">
              <button class="btn btn-primary btn-lg" id="f-start">${state.running ? icon("pause") + " Pause" : icon("play") + (state.elapsed > 0 ? " Resume" : " Start")}</button>
              <button class="btn btn-lg" id="f-reset" ${currentSeconds() < 1 ? "disabled" : ""}>${icon("rotate")} Reset</button>
              <button class="btn btn-lg" id="f-finish" ${currentSeconds() < 1 ? "disabled" : ""}>${icon("check")} Finish &amp; log</button>
            </div>

            <div class="focus-options">
              <div class="segmented" role="group" aria-label="Timer mode">
                <button data-mode="focus" aria-pressed="${state.mode === "focus"}">Open session</button>
                <button data-mode="pomodoro" aria-pressed="${state.mode === "pomodoro"}">Pomodoro ${Math.round(workLength() / 60)}/${Math.round(breakLength() / 60)}</button>
              </div>
              <label class="switch">
                <input type="checkbox" id="f-complete-task" ${task.done ? "checked disabled" : ""} />
                <span class="track"></span>
                <span>${task.done ? "Task already complete" : "Complete the task when I finish"}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="focus-foot">
          <section class="focus-history">
            <div class="section-head"><h2>This task, today</h2><span class="meta">${U.plural(sessions.today.length, "session")} · ${U.fmtDur(sessions.total)}</span></div>
            <div class="rows panel">
              ${sessions.today.length ? sessions.today.map((s) => `
                <div class="row-item">
                  <span style="color:var(--ink-3)">${icon("focus")}</span>
                  <div class="grow"><div class="row-title" style="font-size:12.5px">${s.mode === "pomodoro" ? "Pomodoro" : "Open session"}</div>
                  <div class="row-meta">${U.fmtDate(s.date, "medium")}</div></div>
                  <span class="mono" style="font-size:11px">${U.fmtDur(s.minutes)}</span>
                </div>`).join("") : `<div class="focus-history-empty">No sessions yet. Starting is the hard part.</div>`}
            </div>
          </section>

          <aside class="focus-side">
            <div class="focus-today">
              <span class="stat-label">Focused today</span>
              <span class="mono focus-today-num">${U.fmtDur(todayFocus)}</span>
              <span class="focus-today-note">across ${U.plural(st.focusSessions.filter((s) => s.date === U.todayISO()).length, "session")}</span>
            </div>
            ${otherProjects.length ? `<div class="focus-next">
              <span class="stat-label">Also waiting</span>
              ${otherProjects.map((p) => `<a class="focus-next-row" href="#/project/${p.id}">
                <span class="pdot" style="--tone:var(--p-${p.color})"></span>
                <span class="grow truncate">${esc(p.name)}</span>
                <span class="mono">${store.projectProgress(p.id).pct}%</span>
              </a>`).join("")}
            </div>` : ""}
          </aside>
        </div>
      </div>`;

    main.querySelector("#f-start").addEventListener("click", () => {
      if (state.running) pause(); else start();
      renderSelf();
    });    main.querySelector("#f-reset").addEventListener("click", async () => {
      if (currentSeconds() > 30) {
        const ok = await ui.confirm({
          title: "Reset the clock?",
          body: "Time on this session will not be logged. The task itself is untouched.",
          confirmLabel: "Reset",
        });
        if (!ok) return;
      }
      resetTimer();
      renderSelf();
    });
    main.querySelector("#f-finish").addEventListener("click", finish);
    main.querySelector("#f-change").addEventListener("click", chooser);
    main.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
      if (state.mode === b.dataset.mode) return;
      if (currentSeconds() > 30) {
        ui.toast("Finish or reset this session before changing the timer.", { kind: "danger" });
        return;
      }
      state.mode = b.dataset.mode;
      resetTimer();
      renderSelf();
    }));
    ui.bind(main, {});
    ensureTicker();
    updateVisuals();
  }

  function destroy() {
    stopTicker();
    resetTimer();
  }

  POS.views = POS.views || {};
  POS.views.focus = { render, destroy };
})();
