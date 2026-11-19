/* Tasks — the full ledger. Filters are local and instant. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const filters = { status: "open", project: "all", q: "" };

  const groupsFor = (list, today) => {
    const buckets = [
      { id: "behind", label: "Behind", note: "Past their day", rows: [] },
      { id: "today", label: "Today", note: U.fmtDate(today, "medium"), rows: [] },
      { id: "week", label: "This week", note: "Next six days", rows: [] },
      { id: "later", label: "Later", note: "Beyond this week", rows: [] },
      { id: "done", label: "Completed", note: "Most recent first", rows: [] },
    ];
    const weekEnd = U.addDays(today, 6);
    list.forEach((t) => {
      if (t.done) buckets[4].rows.push(t);
      else if (t.date < today) buckets[0].rows.push(t);
      else if (t.date === today) buckets[1].rows.push(t);
      else if (t.date <= weekEnd) buckets[2].rows.push(t);
      else buckets[3].rows.push(t);
    });
    buckets[4].rows.sort((a, b) => String(b.completedAt || b.date).localeCompare(String(a.completedAt || a.date)));
    return buckets.filter((b) => b.rows.length);
  };

  function render(main) {
    const st = store.get();
    const today = U.todayISO();
    const all = st.tasks;
    const open = all.filter((t) => !t.done);
    const done = all.filter((t) => t.done);
    const late = open.filter((t) => t.date < today);
    const projects = st.projects.filter((p) => p.status !== "archived");

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Tasks</h1>
            <div class="page-sub">
              <span><strong class="ink-2">${open.length}</strong> open</span>
              <span class="dot-sep">·</span>
              <span class="${late.length ? "danger" : ""}">${late.length} behind</span>
              <span class="dot-sep">·</span>
              <span>${done.length} completed</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn" data-act="assistant">${icon("sparkles")} Ask the assistant</button>
            <button class="btn btn-primary" id="new-task">${icon("plus")} New task</button>
          </div>
        </header>

        <div class="filter-bar">
          <div class="segmented" role="group" aria-label="Filter by status">
            ${[["open", "Open"], ["overdue", "Behind"], ["done", "Done"], ["all", "All"]].map(([id, label]) => `
              <button data-status="${id}" aria-pressed="${filters.status === id}">${label}</button>`).join("")}
          </div>
          <div class="filter-spacer"></div>
          <label class="filter-select">
            <span class="sr-only">Filter by project</span>
            <select class="select" id="f-project">
              <option value="all">Every project</option>
              ${projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}
              <option value="personal">Personal only</option>
            </select>
          </label>
          <div class="search-field filter-search">
            ${icon("search", "ico-sm")}
            <input id="f-search" placeholder="Filter by word" aria-label="Filter tasks by word" />
          </div>
        </div>

        <div id="task-groups"></div>
        <div id="task-empty" hidden>${ui.emptyState("Nothing matches", "No task matches this combination of filters. Widen one to see the rest.", `<button class="btn btn-sm" id="clear-filters">Clear filters</button>`)}</div>
      </div>`;

    const target = main.querySelector("#task-groups");
    const empty = main.querySelector("#task-empty");
    const search = main.querySelector("#f-search");
    const projectSel = main.querySelector("#f-project");

    const draw = () => {
      const q = filters.q.trim().toLowerCase();
      let pool = all.slice();
      if (filters.status === "open") pool = pool.filter((t) => !t.done);
      if (filters.status === "overdue") pool = pool.filter((t) => !t.done && t.date < today);
      if (filters.status === "done") pool = pool.filter((t) => t.done);
      pool = pool.filter((t) => {
        if (filters.project === "all") return true;
        if (filters.project === "personal") return !t.projectId;
        return t.projectId === filters.project;
      });
      if (q) pool = pool.filter((t) => {
        const p = t.projectId ? store.project(t.projectId) : null;
        return (t.title + " " + (t.notes || "") + " " + (p ? p.name : "")).toLowerCase().includes(q);
      });

      const sorted = pool.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.done) return String(b.completedAt || "").localeCompare(String(a.completedAt || ""));
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (a.start == null ? 9999 : a.start) - (b.start == null ? 9999 : b.start);
      });

      const groups = groupsFor(sorted, today);
      target.innerHTML = groups.map((g) => `
        <section class="ledger-group">
          <div class="ledger-group-head">
            <h2>${g.label}</h2>
            <span class="mono">${g.rows.length}</span>
            <span class="lg-note">${g.note}</span>
          </div>
          <div class="rows panel">
            ${g.rows.map((t) => ui.taskRow(t, { showDate: true, showTime: true })).join("")}
          </div>
        </section>`).join("");
      empty.hidden = groups.length > 0;
      ui.bind(target, {
        "add-task": () => ui.quickAddTask(today),
      });
    };

    main.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", () => {
      filters.status = b.dataset.status;
      main.querySelectorAll("[data-status]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }));
    projectSel.addEventListener("change", () => { filters.project = projectSel.value; draw(); });
    search.addEventListener("input", () => { filters.q = search.value; draw(); });
    main.querySelector("#clear-filters").addEventListener("click", () => {
      filters.status = "open"; filters.project = "all"; filters.q = "";
      search.value = ""; projectSel.value = "all";
      main.querySelectorAll("[data-status]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.status === "open")));
      draw();
    });
    main.querySelector("#new-task").addEventListener("click", () => ui.quickAddTask(today));
    draw();
  }

  POS.views = POS.views || {};
  POS.views.tasks = { render };
})();
