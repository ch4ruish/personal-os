/* Habits — small things, kept honestly. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  function bestStreak(h, days = 365) {
    let best = 0;
    let run = 0;
    for (let i = days; i >= 0; i--) {
      const d = U.addDays(U.todayISO(), -i);
      if (h.log[d]) { run++; best = Math.max(best, run); } else run = 0;
    }
    return best;
  }

  function perfectDays(habits, days = 30) {
    if (!habits.length) return 0;
    let n = 0;
    for (let i = 0; i < days; i++) {
      const d = U.addDays(U.todayISO(), -i);
      if (habits.every((h) => h.log[d])) n++;
    }
    return n;
  }

  function weekStrip(h) {
    const week = store.habitWeek(h);
    return `
      <div class="habit-week" role="group" aria-label="${esc(h.name)} — last seven days">
        ${week.map((d) => {
          const day = U.fromISO(d.date);
          const isToday = d.date === U.todayISO();
          return `<button class="habit-day ${d.done ? "is-on" : ""} ${isToday ? "is-today" : ""}"
            data-habit-day="${h.id}" data-date="${d.date}" aria-pressed="${d.done}"
            aria-label="${U.fmtDate(d.date, "medium")}${d.done ? ", done" : ", not done"}">
            <span class="mono">${U.DOW_S[day.getDay()][0]}</span>
            <span class="habit-day-num mono">${day.getDate()}</span>
            <span class="habit-day-mark">${d.done ? icon("check", "ico-sm") : ""}</span>
          </button>`;
        }).join("")}
      </div>`;
  }

  function monthGrid(h) {
    const days = Array.from({ length: 30 }, (_, i) => U.addDays(U.todayISO(), i - 29));
    return `
      <div class="habit-month" role="group" aria-label="${esc(h.name)} — thirty days">
        ${days.map((d) => {
          const done = !!h.log[d];
          return `<button class="habit-cell ${done ? "is-on" : ""} ${d === U.todayISO() ? "is-today" : ""}"
            data-habit-day="${h.id}" data-date="${d}" aria-pressed="${done}"
            aria-label="${U.fmtDate(d, "medium")}${done ? ", done" : ", not done"}"
            title="${U.fmtDate(d, "medium")}"></button>`;
        }).join("")}
      </div>`;
  }

  function habitPanel(h, index) {
    const done = store.habitDone(h);
    const streak = store.habitStreak(h);
    const best = bestStreak(h);
    const pct = store.habitConsistency(h);
    const total = Object.keys(h.log || {}).length;
    return `
      <section class="habit-panel panel" data-habit-panel="${h.id}">
        <div class="habit-head">
          <span class="habit-index serif">${String(index + 1).padStart(2, "0")}</span>
          <label class="check habit-check ${done ? "is-done" : ""}">
            <input type="checkbox" ${done ? "checked" : ""} data-act="toggle-habit" data-id="${h.id}" aria-label="${esc(h.name)}" />
            <span class="check-label grow">
              <span class="habit-title">${esc(h.name)}</span>
              <span class="habit-meta">
                <span class="mono">${streak} DAY STREAK</span>
                <span class="sep">·</span>
                <span class="mono">${pct}% / 30 DAYS</span>
                <span class="sep">·</span>
                <span>${total} total</span>
              </span>
            </span>
          </label>
          <div class="habit-actions">
            <span class="habit-today-state ${done ? "is-done" : ""}">${done ? "Done today" : "Not yet today"}</span>
            <button class="icon-btn icon-btn-sm" data-habit-menu="${h.id}" aria-label="Habit actions" aria-haspopup="menu">${icon("more")}</button>
          </div>
        </div>
        <div class="habit-body">
          ${weekStrip(h)}
          <div class="habit-analysis">
            <div class="habit-analysis-row">
              <span class="stat-label">Thirty days</span>
              <span class="mono" style="font-size:10.5px">${pct}%</span>
            </div>
            ${ui.meter(pct, "positive")}
            ${monthGrid(h)}
            <div class="habit-mini-meta">
              <span>Best run <strong class="mono">${best}d</strong></span>
              <span>Last miss <strong class="mono">${lastMiss(h)}</strong></span>
            </div>
          </div>
        </div>
      </section>`;
  }

  function lastMiss(h) {
    for (let i = 0; i < 30; i++) {
      const d = U.addDays(U.todayISO(), -i);
      if (!h.log[d]) return i === 0 ? "today" : i === 1 ? "yesterday" : i + "d ago";
    }
    return "clean month";
  }

  function render(main) {
    const st = store.get();
    const habits = st.habits;
    const todayDone = habits.filter((h) => store.habitDone(h)).length;
    const pctToday = habits.length ? Math.round((todayDone / habits.length) * 100) : 0;
    const avg = habits.length ? Math.round(habits.reduce((n, h) => n + store.habitConsistency(h), 0) / habits.length) : 0;
    const bestRun = habits.reduce((n, h) => Math.max(n, bestStreak(h)), 0);
    const perfect = perfectDays(habits);

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Habits</h1>
            <div class="page-sub">
              <span>${habits.length} tracked</span>
              <span class="dot-sep">·</span>
              <span>${todayDone} done today</span>
              <span class="dot-sep">·</span>
              <span>${avg}% average consistency</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" data-act="assistant">${icon("sparkles")} Ask about streaks</button>
            <button class="btn btn-primary" id="habit-new">${icon("plus")} New habit</button>
          </div>
        </header>

        <div class="habit-stats">
          <div class="habit-stat">
            <span class="stat-label">Today</span>
            <span class="mono habit-stat-num">${todayDone}<span class="habit-stat-den">/${habits.length}</span></span>
            <div class="habit-stat-meter">${ui.meter(pctToday, "positive")}</div>
            <span class="habit-stat-note">${pctToday === 100 ? "Every habit, done." : pctToday === 0 ? "The day is still open." : "Keep the easy ones easy."}</span>
          </div>
          <div class="habit-stat">
            <span class="stat-label">Longest run</span>
            <span class="mono habit-stat-num">${bestRun}<span class="habit-stat-den"> days</span></span>
            <span class="habit-stat-note">across all habits, all time</span>
          </div>
          <div class="habit-stat">
            <span class="stat-label">Thirty days</span>
            <span class="mono habit-stat-num">${avg}<span class="habit-stat-den">%</span></span>
            <span class="habit-stat-note">average consistency</span>
          </div>
          <div class="habit-stat">
            <span class="stat-label">Perfect days</span>
            <span class="mono habit-stat-num">${perfect}</span>
            <span class="habit-stat-note">in the last 30, every habit</span>
          </div>
        </div>

        <div class="habit-toolbar">
          <span class="mono">LAST 30 DAYS · CLICK ANY CELL TO CORRECT THE RECORD</span>
          <span style="font-size:11px;color:var(--ink-3)">Habit reminders follow <a class="link" href="#/settings">notification settings</a>.</span>
        </div>

        <div class="habit-list">
          ${habits.length ? habits.map(habitPanel).join("") : `<div class="panel">${ui.emptyState(
            "Nothing tracked",
            "Start with one habit you can keep on a bad day. The point is the record, not the streak.",
            `<button class="btn btn-primary btn-sm" id="habit-new-empty">${icon("plus")} Add the first habit</button>`
          )}</div>`}
        </div>
      </div>`;

    const open = () => newHabit(main);
    main.querySelector("#habit-new").addEventListener("click", open);
    main.querySelector("#habit-new-empty")?.addEventListener("click", open);
    ui.bind(main, {
      "toggle-habit": (el) => store.actions.toggleHabitToday(el.dataset.id),
    });
    main.querySelectorAll("[data-habit-day]").forEach((b) => b.addEventListener("click", () => {
      const h = store.habit(b.dataset.habitDay);
      if (!h) return;
      const date = b.dataset.date;
      store.actions.logHabit(h.id, date, !h.log[date]);
    }));
    main.querySelectorAll("[data-habit-menu]").forEach((b) => b.addEventListener("click", (e) => {
      const h = store.habit(b.dataset.habitMenu);
      if (!h) return;
      ui.menu(e.currentTarget, [
        {
          icon: "edit", label: "Rename habit", onClick: () => editHabit(h, main),
        },
        "-",
        {
          icon: "trash", label: "Delete habit", danger: true, onClick: async () => {
            const ok = await ui.confirm({
              title: "Delete this habit?",
              body: `“${h.name}” and its ${Object.keys(h.log || {}).length} recorded days will be removed. This does not touch tasks or notes.`,
              confirmLabel: "Delete habit",
              danger: true,
            });
            if (!ok) return;
            store.actions.deleteHabit(h.id);
            ui.toast("Habit deleted.");
          },
        },
      ]);
    }));
  }

  function newHabit(main) {
    const m = ui.modal({
      title: "New habit",
      sub: "Small enough to keep on a bad day.",
      body: `
        <div class="stack gap-4">
          <div class="field">
            <label class="label" for="h-name">Habit</label>
            <input class="input" id="h-name" placeholder="e.g. Walk 8,000 steps" autofocus />
          </div>
          <div class="field">
            <label class="label" for="h-unit">Measure <span class="opt">optional</span></label>
            <input class="input" id="h-unit" placeholder="e.g. pages, session, walk" />
            <span class="field-help">Shown beside the habit so the number means something.</span>
          </div>
          <p class="field-help">Reminders come from the notification centre. No external service is connected.</p>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="h-save">Add habit</button>`,
      onMount: (el, close) => {
        el.querySelector("#h-save").addEventListener("click", () => {
          const name = el.querySelector("#h-name").value.trim();
          if (!name) { ui.toast("A habit needs a name.", { kind: "danger" }); return; }
          store.actions.addHabit(name, el.querySelector("#h-unit").value.trim() || "day");
          close();
          ui.toast("Habit added. Today is the first mark.");
        });
      },
    });
    return m;
  }

  function editHabit(h, main) {
    ui.modal({
      title: "Rename habit",
      body: `
        <div class="stack gap-4">
          <div class="field"><label class="label" for="hr-name">Habit</label>
            <input class="input" id="hr-name" value="${esc(h.name)}" autofocus /></div>
          <div class="field"><label class="label" for="hr-unit">Measure</label>
            <input class="input" id="hr-unit" value="${esc(h.unit || "day")}" /></div>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="hr-save">Save</button>`,
      onMount: (el, close) => {
        el.querySelector("#hr-save").addEventListener("click", () => {
          const name = el.querySelector("#hr-name").value.trim();
          if (!name) { ui.toast("A habit needs a name.", { kind: "danger" }); return; }
          store.set((s) => {
            const target = s.habits.find((x) => x.id === h.id);
            if (target) {
              target.name = name;
              target.unit = el.querySelector("#hr-unit").value.trim() || "day";
            }
          }, "habit:update");
          close();
          ui.toast("Habit updated.");
        });
      },
    });
  }

  POS.views = POS.views || {};
  POS.views.habits = { render };
})();
