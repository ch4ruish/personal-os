/* Notifications — helpful, contextual, dismissible. Never nagging. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const state = { filter: "all" };

  const TYPE_META = {
    reminder: { label: "Reminder", icon: "clock" },
    overdue: { label: "Behind", icon: "warning" },
    deadline: { label: "Deadline", icon: "flag" },
    habit: { label: "Habit", icon: "habits" },
    reschedule: { label: "Rescheduling", icon: "rotate" },
  };

  const ENABLED = {
    reminder: () => store.get().settings.notifyTasks,
    overdue: () => store.get().settings.notifyTasks,
    deadline: () => store.get().settings.notifyDeadlines,
    habit: () => store.get().settings.notifyHabits,
    reschedule: () => store.get().settings.notifyReschedule,
  };

  const FILTERS = [
    ["all", "All"],
    ["reminder", "Reminders"],
    ["deadline", "Deadlines"],
    ["habit", "Habits"],
    ["reschedule", "Rescheduling"],
  ];

  function timeLabel(ts) {
    const diff = Math.round((Date.now() - ts) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return diff + " min ago";
    if (diff < 1440) return Math.round(diff / 60) + "h ago";
    if (diff < 2880) return "yesterday";
    return Math.round(diff / 1440) + "d ago";
  }

  function actionButtons(n) {
    const task = n.taskId ? store.task(n.taskId) : null;
    return (n.actions || []).map((a) => {
      if (a === "start") {
        const href = task ? "#/focus?task=" + task.id : "#/calendar";
        return `<a class="btn btn-sm btn-primary" href="${href}" data-notif-read="${n.id}">${icon("play")} Start now</a>`;
      }
      if (a === "reschedule") {
        return `<a class="btn btn-sm" href="#/reschedule" data-notif-read="${n.id}">${icon("rotate")} Reschedule</a>`;
      }
      if (a === "done") {
        return `<button class="btn btn-sm" data-notif-done="${n.id}">${icon("check")} Done today</button>`;
      }
      if (a === "view") {
        const href = task ? "#/tasks" : n.type === "deadline" ? "#/projects" : "#/calendar";
        return `<a class="btn btn-sm" href="${href}" data-notif-read="${n.id}">View</a>`;
      }
      return `<button class="btn btn-sm btn-ghost" data-notif-dismiss="${n.id}">Dismiss</button>`;
    }).join("");
  }

  function notifRow(n) {
    const meta = TYPE_META[n.type] || TYPE_META.reminder;
    return `
      <article class="notif ${n.read ? "is-read" : ""}" data-notif="${n.id}">
        <span class="notif-icon ${n.read ? "" : "is-new"}">${icon(meta.icon)}</span>
        <div class="notif-body">
          <div class="notif-top">
            <span class="notif-type mono">${meta.label}</span>
            <span class="notif-time mono">${timeLabel(n.createdAt)}</span>
            ${!n.read ? '<span class="notif-new mono">NEW</span>' : ""}
          </div>
          <h3 class="notif-title">${esc(n.title)}</h3>
          <p class="notif-text">${esc(n.body)}</p>
          <div class="notif-actions">${actionButtons(n)}</div>
        </div>
        <button class="icon-btn icon-btn-sm notif-menu" data-notif-dismiss="${n.id}" aria-label="Dismiss notification" title="Dismiss">
          ${icon("close")}
        </button>
      </article>`;
  }

  function render(main) {
    const st = store.get();
    const enabledTypes = Object.keys(ENABLED).filter((t) => ENABLED[t]());
    const all = st.notifications.filter((n) => enabledTypes.includes(n.type));
    const unread = all.filter((n) => !n.read);
    const pool = state.filter === "all" ? all : all.filter((n) => n.type === state.filter);
    const fresh = pool.filter((n) => !n.read);
    const earlier = pool.filter((n) => n.read);
    const late = store.overdue();
    const todayTasks = store.tasksFor(U.todayISO()).filter((t) => !t.done);
    const habitsLeft = st.habits.filter((h) => !store.habitDone(h));
    const disabled = Object.keys(ENABLED).filter((t) => !ENABLED[t]());

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Notifications</h1>
            <div class="page-sub">
              <span>${all.length} active</span>
              <span class="dot-sep">·</span>
              <span>${unread.length} unread</span>
              <span class="dot-sep">·</span>
              <span>checked against your own data</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn" id="n-mark" ${unread.length ? "" : "disabled"}>${icon("check")} Mark all read</button>
            <button class="btn btn-ghost" id="n-clear" ${earlier.length || all.some((n) => n.read) ? "" : "disabled"}>Clear read</button>
          </div>
        </header>

        <div class="filter-bar">
          <div class="segmented" role="group" aria-label="Filter notifications">
            ${FILTERS.map(([id, label]) => {
              const count = id === "all" ? all.length : all.filter((n) => n.type === id).length;
              return `<button data-filter="${id}" aria-pressed="${state.filter === id}">${label}<span class="chip-count mono">${count}</span></button>`;
            }).join("")}
          </div>
        </div>

        <div class="split">
          <div class="stack gap-5">
            ${disabled.length ? `<div class="note note-quiet">${icon("bell")}
              <div>${disabled.map((t) => TYPE_META[t].label).join(", ")} notifications are off. <a class="link" href="#/settings">Change in Settings</a>.</div>
            </div>` : ""}

            ${fresh.length ? `
              <section>
                <div class="section-head"><h2>New</h2><span class="meta">${fresh.length} waiting</span></div>
                <div class="notif-list">${fresh.map(notifRow).join("")}</div>
              </section>` : ""}

            ${earlier.length ? `
              <section>
                <div class="section-head"><h2>Earlier</h2><span class="meta">already seen</span></div>
                <div class="notif-list is-read">${earlier.map(notifRow).join("")}</div>
              </section>` : ""}

            ${!pool.length ? `<div class="panel">${ui.emptyState(
              "Nothing needs you",
              all.length ? "No notification of this kind is waiting. The other filters still have a few." : "Everything is on track. Reminders will appear here when a task, deadline or habit actually needs attention.",
              `<button class="btn btn-sm" data-act="assistant">${icon("sparkles")} Ask what matters</button>`
            )}</div>` : ""}
          </div>

          <aside class="rail-stack">
            <section class="panel">
              <div class="panel-head"><h2>What is watched</h2><span class="meta">right now</span></div>
              <div class="rows">
                <a class="row-item" href="#/tasks">
                  <span style="color:var(--ink-3)">${icon("tasks")}</span>
                  <div class="grow"><div class="row-title" style="font-size:12.5px">Tasks today</div>
                  <div class="row-meta">${todayTasks.length} still open</div></div>
                  <span class="mono" style="font-size:12px">${todayTasks.length}</span>
                </a>
                <a class="row-item" href="#/reschedule">
                  <span style="color:${late.length ? "var(--danger)" : "var(--ink-3)"}">${icon("warning")}</span>
                  <div class="grow"><div class="row-title" style="font-size:12.5px">Behind schedule</div>
                  <div class="row-meta">${late.length ? "A rescheduling proposal is ready" : "Nothing is late"}</div></div>
                  <span class="mono" style="font-size:12px">${late.length}</span>
                </a>
                <a class="row-item" href="#/habits">
                  <span style="color:var(--ink-3)">${icon("habits")}</span>
                  <div class="grow"><div class="row-title" style="font-size:12.5px">Habits</div>
                  <div class="row-meta">${habitsLeft.length ? habitsLeft.length + " still open today" : "All done today"}</div></div>
                  <span class="mono" style="font-size:12px">${st.habits.length - habitsLeft.length}/${st.habits.length}</span>
                </a>
                <div class="row-item">
                  <span style="color:var(--ink-3)">${icon("moon")}</span>
                  <div class="grow"><div class="row-title" style="font-size:12.5px">Quiet hours</div>
                  <div class="row-meta">Nothing is sent while you sleep</div></div>
                  <span class="mono" style="font-size:10.5px;color:var(--ink-3)">${esc(st.settings.quietHours)}</span>
                </div>
              </div>
            </section>

            <section class="note note-quiet">
              ${icon("sparkles")}
              <div><strong>Why this exists</strong>
              <p style="margin-top:3px">Reminders are derived from tasks, events, deadlines and habits already in the app. No push service is connected, so nothing leaves this browser.</p></div>
            </section>
          </aside>
        </div>
      </div>`;

    main.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      state.filter = b.dataset.filter;
      render(main);
    }));

    main.querySelector("#n-mark").addEventListener("click", () => {
      store.actions.markNotifications(true);
      ui.toast("All notifications marked read.");
    });

    main.querySelector("#n-clear").addEventListener("click", async () => {
      const read = all.filter((n) => n.read).length;
      if (!read) { ui.toast("There is nothing read to clear."); return; }
      const ok = await ui.confirm({
        title: "Clear read notifications?",
        body: `${read} already-read notification${read === 1 ? "" : "s"} will be removed. Tasks, habits and events stay untouched.`,
        confirmLabel: "Clear read",
      });
      if (!ok) return;
      store.set((s) => { s.notifications = s.notifications.filter((n) => !n.read); }, "notifications:clear");
      ui.toast("Read notifications cleared.");
    });

    main.querySelectorAll("[data-notif-read]").forEach((el) => el.addEventListener("click", () => {
      store.actions.readNotification(el.dataset.notifRead);
    }));

    main.querySelectorAll("[data-notif-dismiss]").forEach((b) => b.addEventListener("click", () => {
      const n = store.get().notifications.find((x) => x.id === b.dataset.notifDismiss);
      if (!n) return;
      store.actions.dismissNotification(n.id);
      ui.toast("Notification dismissed.", {
        action: {
          label: "Undo",
          onClick: () => {
            store.set((s) => { s.notifications.unshift(n); }, "notification:restore");
          },
        },
      });
    }));

    main.querySelectorAll("[data-notif-done]").forEach((b) => b.addEventListener("click", () => {
      const n = store.get().notifications.find((x) => x.id === b.dataset.notifDone);
      if (!n) return;
      const habit = store.get().habits.find((h) => n.title.toLowerCase().includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(n.title.toLowerCase()));
      if (habit) {
        if (!store.habitDone(habit)) store.actions.toggleHabitToday(habit.id);
        store.actions.readNotification(n.id);
        ui.toast(`${habit.name} marked done today.`);
      } else {
        ui.toast("Open Habits to log this one.", {
          action: { label: "Habits", onClick: () => { location.hash = "#/habits"; } },
        });
      }
    }));

    main.querySelectorAll("[data-notif]").forEach((el) => el.addEventListener("click", (e) => {
      if (e.target.closest("button, a")) return;
      const n = store.get().notifications.find((x) => x.id === el.dataset.notif);
      if (n && !n.read) store.actions.readNotification(n.id);
    }));
  }

  POS.views = POS.views || {};
  POS.views.notifications = { render };
})();
