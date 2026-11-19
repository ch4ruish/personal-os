/* Reflection — the week, read honestly from its own record. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const state = {
    start: null,
    noteSaved: "",
  };

  function delta(n, suffix = "") {
    if (!n) return `<span class="rf-delta is-flat">no change${suffix}</span>`;
    return `<span class="rf-delta ${n > 0 ? "is-up" : "is-down"}">${n > 0 ? "↑" : "↓"} ${Math.abs(n)}${suffix}</span>`;
  }

  function observations(ws, prev, habits, behind) {
    const out = [];
    const habitBest = habits.map((h) => ({
      h,
      done: ws.days.filter((d) => h.log[d]).length,
    })).sort((a, b) => b.done - a.done);
    if (ws.total === 0) {
      out.push("No tasks were scheduled this week. That is either recovery or drift — only you know which.");
      return out;
    }
    if (ws.pct >= 75) out.push(`Completion held at ${ws.pct}%. The plan was roughly honest about what a week could hold.`);
    else if (ws.pct < 50) out.push(`Only ${ws.pct}% of scheduled work closed. The week was overbooked, not wasted — the plan needs less in it.`);
    else out.push(`${ws.pct}% of scheduled work closed, which is a working week, not a perfect one.`);
    if (habitBest.length && habitBest[0].done >= 5) {
      out.push(`“${habitBest[0].h.name}” was the steady one at ${habitBest[0].done} of 7 days. Keep it as the anchor.`);
    }
    if (habitBest.length && habitBest[habitBest.length - 1].done <= 2) {
      out.push(`“${habitBest[habitBest.length - 1].h.name}” only landed ${habitBest[habitBest.length - 1].done} time${habitBest[habitBest.length - 1].done === 1 ? "" : "s"}. Shrink it before deciding the habit is the problem.`);
    }
    if (prev.focus && ws.focus < prev.focus * 0.8) {
      out.push(`Focus time fell from ${U.fmtDur(prev.focus)} to ${U.fmtDur(ws.focus)}. Protect one long block before the week fills itself.`);
    } else if (ws.focus > prev.focus && ws.focus >= 90) {
      out.push(`Focus time rose to ${U.fmtDur(ws.focus)}. This is the number that made the rest possible.`);
    }
    if (behind.length) {
      out.push(`${behind.length} task${behind.length === 1 ? "" : "s"} carried into next week. Move them deliberately instead of inheriting them.`);
    }
    return out.slice(0, 4);
  }

  function render(main) {
    const st = store.get();
    if (!state.start) state.start = U.startOfWeek(U.todayISO(), st.settings.weekStartsMonday);
    const ws = store.weekStats(state.start);
    const prev = store.weekStats(U.addDays(state.start, -7));
    const habits = st.habits;
    const behind = store.overdue();
    const projects = store.activeProjects();
    const maxDay = Math.max(1, ...ws.days.map((d) => {
      const tasks = st.tasks.filter((t) => t.date === d);
      return tasks.length;
    }));
    const notes = observations(ws, prev, habits, behind);
    const wins = st.reflection.wins || [];
    const isThisWeek = state.start === U.startOfWeek(U.todayISO(), st.settings.weekStartsMonday);

    const projectRows = projects.map((p) => {
      const prog = store.projectProgress(p.id);
      const moved = st.tasks.filter((t) => t.projectId === p.id && t.done && ws.days.includes(t.completedAt || t.date)).length;
      return { p, prog, moved };
    }).sort((a, b) => b.moved - a.moved);

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Reflection</h1>
            <div class="page-sub">
              <span>${U.fmtDate(ws.days[0], "medium")} – ${U.fmtDate(ws.days[6], "medium")}</span>
              <span class="dot-sep">·</span>
              <span>${isThisWeek ? "This week, still open" : "Closed week"}</span>
              <span class="dot-sep">·</span>
              <span class="mono">FROM YOUR OWN RECORD</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="icon-btn" id="rf-prev" aria-label="Previous week">${icon("chevron-left")}</button>
            <button class="btn btn-sm" id="rf-this">This week</button>
            <button class="icon-btn" id="rf-next" aria-label="Next week">${icon("chevron-right")}</button>
          </div>
        </header>

        <section class="rf-hero">
          <div class="rf-hero-copy">
            <h2 class="serif">${ws.done === 0 ? "A week with nothing marked." : ws.pct >= 75 ? "A week that mostly held." : ws.pct >= 50 ? "A week that half held." : "A week that needed less in it."}</h2>
            <p>${ws.done} of ${ws.total} scheduled tasks closed, ${U.fmtDur(ws.focus)} in focus, and habits at ${ws.habitPct}%. ${behind.length ? `${behind.length} thing${behind.length === 1 ? "" : "s"} carried forward.` : "Nothing carried forward."}</p>
          </div>
          <div class="rf-hero-meta">
            <span class="mono">${U.fmtDate(ws.days[0], "short")} → ${U.fmtDate(ws.days[6], "short")}</span>
            <span class="mono">${ws.total} SCHEDULED</span>
          </div>
        </section>

        <div class="rf-stats">
          <div class="rf-stat">
            <span class="stat-label">Completion</span>
            <span class="mono rf-stat-num">${ws.pct}<span class="rf-stat-unit">%</span></span>
            <div class="rf-stat-meter">${ui.meter(ws.pct, "positive")}</div>
            ${delta(ws.pct - prev.pct, " pts")}
          </div>
          <div class="rf-stat">
            <span class="stat-label">Focus</span>
            <span class="mono rf-stat-num">${Math.round(ws.focus / 60)}<span class="rf-stat-unit">h ${ws.focus % 60 ? ws.focus % 60 + "m" : ""}</span></span>
            <span class="rf-stat-note">${ws.focus ? `${Math.round(ws.focus / 60)}h in deliberate sessions` : "No focus sessions logged"}</span>
            ${delta(Math.round((ws.focus - prev.focus) / 60), "h")}
          </div>
          <div class="rf-stat">
            <span class="stat-label">Habits</span>
            <span class="mono rf-stat-num">${ws.habitPct}<span class="rf-stat-unit">%</span></span>
            <div class="rf-stat-meter">${ui.meter(ws.habitPct, "positive")}</div>
            ${delta(ws.habitPct - prev.habitPct, " pts")}
          </div>
          <div class="rf-stat">
            <span class="stat-label">Moved forward</span>
            <span class="mono rf-stat-num">${ws.done}</span>
            <span class="rf-stat-note">tasks closed across ${projectRows.filter((r) => r.moved).length} project${projectRows.filter((r) => r.moved).length === 1 ? "" : "s"}</span>
            ${delta(ws.done - prev.done)}
          </div>
        </div>

        <div class="split rf-layout">
          <div class="stack gap-5">
            <section class="panel">
              <div class="panel-head"><h2>The week, day by day</h2><span class="meta">scheduled vs closed</span></div>
              <div class="panel-body">
                <div class="rf-chart" role="img" aria-label="Task completion by day">
                  ${ws.days.map((d, i) => {
                    const tasks = st.tasks.filter((t) => t.date === d);
                    const done = tasks.filter((t) => t.done).length;
                    const isFuture = d > U.todayISO();
                    return `<div class="rf-bar-col ${isFuture ? "is-future" : ""}">
                      <div class="rf-bar-track" title="${U.fmtDate(d, "long")} — ${done} of ${tasks.length}">
                        <div class="rf-bar-open" style="height:${(tasks.length / maxDay) * 100}%"></div>
                        <div class="rf-bar-done" style="height:${(done / maxDay) * 100}%"></div>
                      </div>
                      <span class="mono rf-bar-label">${U.DOW_S[U.fromISO(d).getDay()][0]}</span>
                      <span class="mono rf-bar-count">${done}/${tasks.length}</span>
                    </div>`;
                  }).join("")}
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Projects</h2><span class="meta">${projectRows.length} active</span></div>
              <div class="rows">
                ${projectRows.map(({ p, prog, moved }) => `
                  <a class="row-item" href="#/project/${p.id}">
                    <span class="pdot" style="--tone:var(--p-${p.color})"></span>
                    <div class="grow">
                      <div class="row-title" style="font-size:13px">${esc(p.name)}</div>
                      <div class="row-meta">
                        <span>${prog.done}/${prog.total} tasks</span>
                        <span class="sep">·</span>
                        <span>${moved ? moved + " closed this week" : "no movement this week"}</span>
                      </div>
                    </div>
                    <div class="rf-project-progress">
                      <span style="width:72px">${ui.meter(prog.pct, p.color)}</span>
                      <span class="mono" style="font-size:10.5px">${prog.pct}%</span>
                    </div>
                  </a>`).join("")}
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>What the numbers suggest</h2><span class="meta">specific, not motivational</span></div>
              <div class="panel-body">
                <div class="rf-notes">
                  ${notes.map((n, i) => `<div class="rf-note"><span class="mono rf-note-num">${String(i + 1).padStart(2, "0")}</span><p>${esc(n)}</p></div>`).join("")}
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Your note on the week</h2><span class="mono" id="rf-note-state">${state.noteSaved || "SAVED LOCALLY"}</span></div>
              <div class="panel-body">
                <textarea class="textarea rf-note-input" id="rf-note" placeholder="What worked? What got in the way? What changes next week?">${esc(st.reflection.note || "")}</textarea>
              </div>
            </section>
          </div>

          <aside class="rail-stack">
            <section class="panel">
              <div class="panel-head"><h2>Wins</h2><span class="meta">${wins.length}</span></div>
              <div class="rows">
                ${wins.length ? wins.map((w) => `
                  <div class="row-item" style="align-items:flex-start">
                    <span style="color:var(--positive);margin-top:2px">${icon("check", "ico-sm")}</span>
                    <div class="grow"><div class="row-title" style="white-space:normal;font-size:12.5px">${esc(w.text)}</div>
                    <div class="row-meta"><span class="mono">${U.relDate(w.date)}</span></div></div>
                  </div>`).join("") : `<div class="rf-empty-note">Nothing named yet. A win is anything you would defend if someone asked why the week mattered.</div>`}
              </div>
              <div class="panel-foot">
                <div class="row gap-2">
                  <input class="input" id="rf-win-input" placeholder="Name a win" aria-label="Add a win" style="height:30px;font-size:12px" />
                  <button class="btn btn-sm btn-primary" id="rf-win-add">${icon("plus")} Add</button>
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Carried forward</h2><span class="mono">${behind.length}</span></div>
              <div class="rows">
                ${behind.length ? behind.slice(0, 6).map((t) => `
                  <a class="row-item" href="#/tasks">
                    <div class="grow"><div class="row-title" style="white-space:normal;font-size:12.5px">${esc(t.title)}</div>
                    <div class="row-meta"><span class="mono">${U.relDate(t.date)}</span><span class="sep">·</span><span>${t.projectId ? esc(store.project(t.projectId).name) : "Personal"}</span></div></div>
                  </a>`).join("") : `<div class="rf-empty-note">Nothing is sitting behind. The ledger is clean.</div>`}
              </div>
              ${behind.length ? `<div class="panel-foot"><a class="btn btn-sm btn-block" href="#/reschedule">${icon("rotate")} Find them a new home</a></div>` : ""}
            </section>

            <section class="note note-quiet">
              ${icon("lock")}
              <div><strong>Reflection is local.</strong> These observations are generated from your tasks, sessions and habit log on this device. No model and no network.</div>
            </section>
          </aside>
        </div>
      </div>`;

    main.querySelector("#rf-prev").addEventListener("click", () => {
      state.start = U.addDays(state.start, -7);
      render(main);
    });
    main.querySelector("#rf-next").addEventListener("click", () => {
      state.start = U.addDays(state.start, 7);
      render(main);
    });
    main.querySelector("#rf-this").addEventListener("click", () => {
      state.start = U.startOfWeek(U.todayISO(), st.settings.weekStartsMonday);
      render(main);
    });

    main.querySelector("#rf-win-add").addEventListener("click", addWin);
    main.querySelector("#rf-win-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addWin();
    });
    function addWin() {
      const input = main.querySelector("#rf-win-input");
      const text = input.value.trim();
      if (!text) { ui.toast("Write the win first.", { kind: "danger" }); return; }
      store.actions.addWin(text);
      ui.toast("Win recorded.");
    }

    const note = main.querySelector("#rf-note");
    let saved = state.noteSaved;
    const save = U.debounce(() => {
      store.set((s) => { s.reflection.note = note.value; }, "reflection:note");
      state.noteSaved = "SAVED JUST NOW";
      saved = state.noteSaved;
      const status = main.querySelector("#rf-note-state");
      if (status) status.textContent = state.noteSaved;
    }, 500);
    note.addEventListener("input", save);
    ui.bind(main, {});
  }

  POS.views = POS.views || {};
  POS.views.reflection = { render };
})();
