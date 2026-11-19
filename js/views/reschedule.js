/* Rescheduling — a way back, not a telling-off. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const state = {
    proposal: null,
    selected: {},
    loading: false,
    error: false,
    applied: null,
    declined: false,
  };

  function reset() {
    state.proposal = null;
    state.selected = {};
    state.loading = false;
    state.error = false;
    state.applied = null;
    state.declined = false;
  }

  function load(main) {
    state.loading = true;
    state.error = false;
    state.proposal = null;
    state.applied = null;
    state.declined = false;
    render(main);
    POS.ai.rescheduleProposal()
      .then((proposal) => {
        state.proposal = proposal;
        proposal.moves.forEach((m) => { state.selected[m.taskId] = true; });
        state.loading = false;
        const live = document.getElementById("main");
        if (live && location.hash.startsWith("#/reschedule")) render(live);
      })
      .catch(() => {
        state.loading = false;
        state.error = true;
        const live = document.getElementById("main");
        if (live && location.hash.startsWith("#/reschedule")) render(live);
      });
  }

  function apply(main) {
    const p = state.proposal;
    if (!p) return;
    const moves = p.moves.filter((m) => state.selected[m.taskId] && store.task(m.taskId) && !store.task(m.taskId).done);
    if (!moves.length) { ui.toast("Select at least one move first."); return; }
    ui.confirm({
      title: `Approve ${moves.length} move${moves.length === 1 ? "" : "s"}?`,
      body: `The selected tasks get the new days and times shown. Fixed events are never touched, and every completed task stays where it is. You can still move anything afterwards.`,
      confirmLabel: "Approve moves",
    }).then((ok) => {
      if (!ok) return;
      store.set((s) => {
        moves.forEach((m) => {
          const t = s.tasks.find((x) => x.id === m.taskId);
          if (!t || t.done) return;
          if (t.date !== m.to.date) t.rescheduled = (t.rescheduled || 0) + 1;
          t.date = m.to.date;
          t.start = m.to.start;
        });
      }, "reschedule:apply");
      state.applied = moves;
      state.proposal = null;
      ui.toast(`${moves.length} task${moves.length === 1 ? "" : "s"} moved. The rest of the week is intact.`, {
        action: {
          label: "Undo",
          onClick: () => {
            store.set((s) => {
              moves.forEach((m) => {
                const t = s.tasks.find((x) => x.id === m.taskId);
                if (!t) return;
                t.date = m.from.date;
                t.start = m.from.start;
              });
            }, "reschedule:undo");
            state.applied = null;
            ui.toast("Moves undone. Everything is back where it was.");
            const live = document.getElementById("main");
            if (live) render(live);
          },
        },
      });
      render(main);
    });
  }

  function render(main) {
    const st = store.get();
    const p = state.proposal;
    const selectedCount = p ? p.moves.filter((m) => state.selected[m.taskId]).length : 0;
    const notNow = () => {
      state.declined = true;
      state.proposal = null;
      render(main);
      ui.toast("Nothing moved. The proposal is still available when you come back.");
    };
    const fresh = () => load(main);

    main.innerHTML = `
      <div class="page ${state.applied || state.declined ? "is-condensed" : ""}">
        <header class="page-head">
          <div>
            <h1 class="page-title">Rescheduling</h1>
            <div class="page-sub">
              <span>${state.loading ? "Reading the week…" : p ? `${p.moves.length} proposed move${p.moves.length === 1 ? "" : "s"}` : "A way to catch up"}</span>
              <span class="dot-sep">·</span>
              <span>Nothing moves without you</span>
            </div>
          </div>
          <div class="page-actions">
            ${p ? `<button class="btn" id="r-refresh">${icon("rotate")} Rebuild proposal</button>
                   <button class="btn" id="r-decline">Keep everything as is</button>
                   <button class="btn btn-accent" id="r-apply" ${selectedCount ? "" : "disabled"}>${icon("check")} Approve ${selectedCount} move${selectedCount === 1 ? "" : "s"}</button>`
              : `<button class="btn" id="r-refresh" ${state.loading ? "disabled" : ""}>${icon("rotate")} Check the week</button>`}
          </div>
        </header>

        ${state.loading ? `
          <div class="panel"><div class="panel-body">
            <div class="skeleton sk-line w-40" style="height:13px"></div>
            <div class="skeleton sk-block" style="margin-top:18px"></div>
            <div class="skeleton sk-block" style="margin-top:12px"></div>
            <div class="skeleton sk-block" style="margin-top:12px"></div>
            <p style="font-size:12px;color:var(--ink-3);margin-top:14px">Checking unfinished work, fixed events and the days that still have room.</p>
          </div></div>` : state.error ? `
          <div class="panel"><div class="panel-body">
            <div class="note note-warning">${icon("warning")}<div><strong>The proposal failed to build.</strong> Nothing changed. Try again, or open the calendar and move work by hand.</div></div>
            <div class="row gap-2" style="margin-top:12px">
              <button class="btn btn-sm" id="r-retry">${icon("rotate")} Try again</button>
              <a class="btn btn-sm btn-ghost" href="#/calendar">${icon("calendar")} Open calendar</a>
            </div>
          </div></div>` : state.applied ? `
          <div class="panel r-done">
            <div class="panel-body">
              <div class="r-done-mark">${icon("check", "ico-lg")}</div>
              <h2 class="serif">The week has room again.</h2>
              <p>${state.applied.length} task${state.applied.length === 1 ? "" : "s"} moved. Fixed events, completed work and notes stayed exactly as they were.</p>
              <div class="r-done-list">
                ${state.applied.map((m) => {
                  const t = store.task(m.taskId);
                  return `<div class="row-item">
                    <span class="mono" style="font-size:10.5px;color:var(--ink-3);min-width:84px">${U.fmtDate(m.to.date, "short")} · ${U.fmtMin(m.to.start)}</span>
                    <span class="grow truncate" style="font-size:12.5px">${t ? esc(t.title) : "Task"}</span>
                    <span class="tag tag-positive tag-mono">PLACED</span>
                  </div>`;
                }).join("")}
              </div>
              <div class="row gap-2" style="margin-top:16px">
                <a class="btn btn-primary btn-sm" href="#/calendar">${icon("calendar")} See the calendar</a>
                <button class="btn btn-sm" id="r-again">${icon("rotate")} Check again</button>
              </div>
            </div>
          </div>` : state.declined ? `
          <div class="panel r-done">
            <div class="panel-body">
              <div class="r-done-mark is-quiet">${icon("check", "ico-lg")}</div>
              <h2 class="serif">Nothing moved.</h2>
              <p>That is a valid choice. The week is exactly as you left it, and this proposal can be rebuilt whenever you want it.</p>
              <div class="row gap-2" style="margin-top:16px">
                <button class="btn btn-sm" id="r-again">${icon("rotate")} Build a proposal</button>
                <a class="btn btn-sm btn-ghost" href="#/tasks">${icon("tasks")} Open tasks</a>
              </div>
            </div>
          </div>` : p && p.empty ? `
          <div class="panel r-done">
            <div class="panel-body">
              <div class="r-done-mark">${icon("check", "ico-lg")}</div>
              <h2 class="serif">Nothing is behind.</h2>
              <p>Every open task still has a day ahead of it. There is no conflict to resolve, so I would leave the week alone.</p>
              <div class="row gap-2" style="margin-top:16px">
                <a class="btn btn-sm" href="#/today">${icon("today")} Back to today</a>
                <a class="btn btn-sm btn-ghost" href="#/calendar">${icon("calendar")} Calendar</a>
              </div>
            </div>
          </div>` : p ? `
          <div class="split">
            <div class="stack gap-4">
              <div class="note">${icon("sparkles")}
                <div><strong>What I would change</strong><p style="margin-top:3px">${esc(p.summary)}</p></div>
              </div>
              ${p.warnings && p.warnings.length ? p.warnings.map((w) =>
                `<div class="note note-warning">${icon("warning")}<div>${esc(w)}</div></div>`).join("") : ""}

              <div class="panel">
                <div class="panel-head">
                  <div class="row gap-3">
                    <h2>Proposed moves</h2>
                    <span class="mono" style="font-size:10.5px;color:var(--ink-3)">${p.moves.length} TASKS</span>
                  </div>
                  <button class="btn btn-ghost btn-sm" id="r-toggle">${selectedCount === p.moves.length ? "Deselect all" : "Select all"}</button>
                </div>
                <div class="rows">
                  ${p.moves.map((m) => {
                    const t = store.task(m.taskId);
                    if (!t) return "";
                    const project = t.projectId ? store.project(t.projectId) : null;
                    return `<div class="resched-row ${state.selected[m.taskId] ? "" : "is-off"}">
                      <input type="checkbox" ${state.selected[m.taskId] ? "checked" : ""} data-move="${m.taskId}" aria-label="Include ${esc(t.title)}" />
                      <div class="grow">
                        <div class="resched-title">${esc(t.title)}</div>
                        <div class="resched-meta">
                          ${project ? `<span class="tag tone-${project.color}" style="height:18px"><i class="pdot"></i>${esc(project.name)}</span>` : '<span class="tag tag-outline" style="height:18px">Personal</span>'}
                          <span class="mono">${U.fmtDur(t.duration)}</span>
                        </div>
                        <div class="resched-move">
                          <span class="resched-when is-from">${U.fmtDate(m.from.date, "short")}${m.from.start != null ? " · " + U.fmtMin(m.from.start) : ""}</span>
                          <span class="resched-arrow" aria-hidden="true">→</span>
                          <span class="resched-when is-to">${U.fmtDate(m.to.date, "short")} · ${U.fmtMin(m.to.start)}</span>
                          ${m.conflict ? '<span class="tag tag-warning" style="height:18px">Check overlap</span>' : ""}
                        </div>
                        <p class="resched-why">${esc(m.reason)}</p>
                      </div>
                    </div>`;
                  }).join("")}
                </div>
                <div class="panel-foot spread">
                  <span style="font-size:11.5px;color:var(--ink-3)">${selectedCount} of ${p.moves.length} selected</span>
                  <span class="mono" style="font-size:10px;color:var(--ink-4)">LOCAL AI · PROPOSAL</span>
                </div>
              </div>
            </div>

            <aside class="rail-stack">
              <section class="panel">
                <div class="panel-head"><h2>The proposal</h2><span class="meta">at a glance</span></div>
                <div class="panel-body stack gap-4">
                  <div class="r-stat"><span class="stat-label">Tasks moving</span><span class="mono r-stat-num">${p.moves.length}</span></div>
                  <div class="r-stat"><span class="stat-label">Work to place</span><span class="mono r-stat-num">${U.fmtDur(p.totalMin)}</span></div>
                  <div class="r-stat"><span class="stat-label">Days touched</span><span class="mono r-stat-num">${p.days.length}</span></div>
                  <div class="r-days">
                    ${p.days.map((d) => `<span class="tag tag-outline tag-mono">${U.fmtDate(d, "medium")}</span>`).join("")}
                  </div>
                </div>
              </section>
              <section class="panel">
                <div class="panel-head"><h2>What stays put</h2></div>
                <div class="panel-body r-stays">
                  <div class="row gap-2">${icon("lock", "ico-sm")}<span>All fixed calendar events</span></div>
                  <div class="row gap-2">${icon("check", "ico-sm")}<span>Every completed task</span></div>
                  <div class="row gap-2">${icon("notes", "ico-sm")}<span>Notes, habits and reflections</span></div>
                  <div class="row gap-2">${icon("archive", "ico-sm")}<span>Archived projects</span></div>
                </div>
              </section>
              <section class="note note-quiet">
                ${icon("sparkles")}
                <div><strong>Why ask at all?</strong> Moving work is a decision about your week. The assistant can find the room, but only you can agree to spend it.</div>
              </section>
            </aside>
          </div>` : `
          <div class="panel r-done">
            <div class="panel-body">
              <div class="r-done-mark is-quiet">${icon("rotate", "ico-lg")}</div>
              <h2 class="serif">Ready when you are.</h2>
              <p>I can check unfinished work against the days that still have room and build a proposal. Nothing moves without your approval. Auto-build is off in Settings.</p>
              <div class="row gap-2" style="margin-top:16px">
                <button class="btn btn-primary btn-sm" id="r-check">${icon("rotate")} Check the week</button>
                <a class="btn btn-sm btn-ghost" href="#/settings">${icon("settings")} Settings</a>
              </div>
            </div>
          </div>`}
      </div>`;

    main.querySelector("#r-check")?.addEventListener("click", () => load(main));

    main.querySelector("#r-refresh")?.addEventListener("click", () => load(main));
    main.querySelector("#r-retry")?.addEventListener("click", () => load(main));
    main.querySelector("#r-again")?.addEventListener("click", () => { reset(); load(main); });
    main.querySelector("#r-decline")?.addEventListener("click", notNow);
    main.querySelector("#r-apply")?.addEventListener("click", () => apply(main));
    main.querySelector("#r-toggle")?.addEventListener("click", () => {
      const all = p.moves.every((m) => state.selected[m.taskId]);
      p.moves.forEach((m) => { state.selected[m.taskId] = !all; });
      render(main);
    });
    main.querySelectorAll("[data-move]").forEach((cb) => cb.addEventListener("change", () => {
      state.selected[cb.dataset.move] = cb.checked;
      render(main);
    }));

    if (!state.proposal && !state.loading && !state.error && !state.applied && !state.declined && st.settings.aiAutoReschedule) {
      load(main);
    }
  }

  POS.views = POS.views || {};
  POS.views.reschedule = { render, destroy: reset };
})();
