/* Projects — the list, and one project's workspace. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const COLOURS = [
    ["cobalt", "Cobalt"], ["teal", "Teal"], ["plum", "Plum"],
    ["ochre", "Ochre"], ["moss", "Moss"], ["slate", "Slate"],
  ];

  function projectModal(existing, onDone) {
    const p = existing || { name: "", description: "", deadline: U.addDays(U.todayISO(), 21), color: "cobalt" };
    const m = ui.modal({
      title: existing ? "Edit project" : "New project",
      sub: existing ? "Changes apply immediately." : "A container for milestones and tasks.",
      body: `
        <div class="stack gap-4">
          <div class="field">
            <label class="label" for="p-name">Name</label>
            <input class="input" id="p-name" value="${esc(p.name)}" placeholder="e.g. Design portfolio" autofocus />
          </div>
          <div class="field">
            <label class="label" for="p-desc">Description <span class="opt">optional</span></label>
            <textarea class="textarea" id="p-desc" placeholder="What does done look like?">${esc(p.description)}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label" for="p-deadline">Deadline</label>
              <input class="input" type="date" id="p-deadline" value="${p.deadline}" />
            </div>
            <div class="field">
              <label class="label">Colour</label>
              <div class="swatches" id="p-colours">
                ${COLOURS.map(([id, label]) => `
                  <button type="button" class="swatch ${p.color === id ? "is-on" : ""}" data-colour="${id}" aria-label="${label}" aria-pressed="${p.color === id}" style="--sw:var(--p-${id})"></button>`).join("")}
              </div>
            </div>
          </div>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button>
             <button class="btn btn-primary" id="p-save">${existing ? "Save changes" : "Create project"}</button>`,
      onMount: (el, close) => {
        let colour = p.color;
        el.querySelectorAll("[data-colour]").forEach((b) => b.addEventListener("click", () => {
          colour = b.dataset.colour;
          el.querySelectorAll("[data-colour]").forEach((x) => {
            x.classList.toggle("is-on", x === b);
            x.setAttribute("aria-pressed", String(x === b));
          });
        }));
        el.querySelector("#p-save").addEventListener("click", () => {
          const name = el.querySelector("#p-name").value.trim();
          if (!name) { ui.toast("A project needs a name.", { kind: "danger" }); return; }
          const data = {
            name,
            description: el.querySelector("#p-desc").value.trim(),
            deadline: el.querySelector("#p-deadline").value || p.deadline,
            color: colour,
          };
          if (existing) store.actions.updateProject(existing.id, data);
          else store.actions.addProject(data);
          close();
          ui.toast(existing ? "Project updated." : "Project created.");
          onDone && onDone();
        });
      },
    });
    return m;
  }

  function renderList(main) {
    const st = store.get();
    const active = st.projects.filter((p) => p.status !== "archived");
    const archived = st.projects.filter((p) => p.status === "archived");
    const totalTasks = active.reduce((n, p) => n + store.tasksOfProject(p.id).length, 0);

    main.innerHTML = `
      <div class="page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Projects</h1>
            <div class="page-sub">
              <span>${active.length} active</span><span class="dot-sep">·</span>
              <span>${totalTasks} tasks in flight</span><span class="dot-sep">·</span>
              <span>${archived.length} archived</span>
            </div>
          </div>
          <div class="page-actions">
            <a class="btn btn-ghost" href="#/goal">${icon("sparkles")} Draft a goal</a>
            <button class="btn btn-primary" id="new-project">${icon("plus")} New project</button>
          </div>
        </header>

        ${active.length ? `
        <div class="project-list" role="list">
          <div class="project-row project-row-head" aria-hidden="true">
            <span>Project</span><span>Progress</span><span class="num">Tasks</span><span class="num">Deadline</span><span></span>
          </div>
          ${active.map((p) => {
            const prog = store.projectProgress(p.id);
            const nextMs = (p.milestones || []).find((m) => store.milestoneProgress(p.id, m.id).pct < 100);
            const days = U.diffDays(p.deadline, U.todayISO());
            return `<a class="project-row" href="#/project/${p.id}" role="listitem">
              <div class="project-name">
                <span class="pdot" style="--tone:var(--p-${p.color})"></span>
                <div>
                  <div class="project-title">${esc(p.name)}</div>
                  <div class="project-desc">${nextMs ? "Next: " + esc(nextMs.title) : esc(p.description || "No milestones yet")}</div>
                </div>
              </div>
              <div class="project-progress">
                ${ui.meter(prog.pct, p.color)}
                <span class="mono">${prog.pct}%</span>
              </div>
              <div class="num mono">${prog.done}/${prog.total}</div>
              <div class="num ${days <= 3 ? "warning" : ""}">
                <span class="mono" style="font-size:11.5px">${U.fmtDate(p.deadline, "short")}</span>
                <span class="project-days">${days < 0 ? "overdue" : days === 0 ? "today" : days + " days"}</span>
              </div>
              <span class="project-go">${icon("arrow-right")}</span>
            </a>`;
          }).join("")}
        </div>` : ui.emptyState("No active projects", "Capture a goal, or create a project directly. Milestones can come later.",
          `<button class="btn btn-primary btn-sm" id="new-project-empty">${icon("plus")} New project</button>`)}

        ${archived.length ? `
          <section style="margin-top:40px">
            <div class="section-head">
              <h2>Archived</h2>
              <span class="meta">Read-only by intent</span>
            </div>
            <div class="project-list">
              ${archived.map((p) => {
                const prog = store.projectProgress(p.id);
                return `<a class="project-row is-archived" href="#/project/${p.id}">
                  <div class="project-name">
                    <span class="pdot" style="--tone:var(--p-${p.color})"></span>
                    <div><div class="project-title">${esc(p.name)}</div>
                    <div class="project-desc">${prog.total} tasks · archived</div></div>
                  </div>
                  <div class="project-progress">${ui.meter(prog.pct, p.color)}<span class="mono">${prog.pct}%</span></div>
                  <div class="num mono">${prog.done}/${prog.total}</div>
                  <div class="num"><span class="mono" style="font-size:11.5px">${U.fmtDate(p.deadline, "short")}</span></div>
                  <span class="project-go">${icon("arrow-right")}</span>
                </a>`;
              }).join("")}
            </div>
          </section>` : ""}
      </div>`;

    const open = () => projectModal(null, () => {
      const current = document.getElementById("main");
      renderList(current);
    });
    main.querySelector("#new-project")?.addEventListener("click", open);
    main.querySelector("#new-project-empty")?.addEventListener("click", open);
  }

  function renderWorkspace(main, params) {
    const p = store.project(params.id);
    if (!p) {
      main.innerHTML = `<div class="page">${ui.emptyState("Project not found", "It may have been deleted.", `<a class="btn" href="#/projects">Back to projects</a>`)}</div>`;
      return;
    }
    const prog = store.projectProgress(p.id);
    const tasks = store.tasksOfProject(p.id).sort((a, b) => (a.date + String(a.start || 0)).localeCompare(b.date + String(b.start || 0)));
    const notes = store.notesForProject(p.id).slice(0, 3);
    const days = U.diffDays(p.deadline, U.todayISO());
    const archived = p.status === "archived";
    const msList = p.milestones || [];

    main.innerHTML = `
      <div class="page">
        <div class="workspace-back">
          <a class="btn btn-ghost btn-sm" href="#/projects">${icon("arrow-left")} Projects</a>
          ${archived ? '<span class="tag tag-outline tag-mono">ARCHIVED</span>' : ""}
        </div>

        <header class="project-head">
          <div class="row gap-3" style="align-items:flex-start">
            <span class="project-mark" style="--tone:var(--p-${p.color})"></span>
            <div class="grow">
              <h1 class="page-title" style="font-size:36px">${esc(p.name)}</h1>
              <p class="project-blurb">${esc(p.description || "No description yet.")}</p>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn" id="w-add-task">${icon("plus")} Task</button>
            <a class="btn" href="#/goal?project=${p.id}">${icon("sparkles")} Re-plan</a>
            <button class="icon-btn" id="w-menu" aria-label="Project actions" aria-haspopup="menu">${icon("more")}</button>
          </div>
        </header>

        <div class="project-stats">
          <div class="pstat">
            <span class="pstat-label">Progress</span>
            <div class="pstat-value">
              <div class="meter meter-thick tone-${p.color}" style="flex:1;max-width:180px"><i style="--value:${prog.pct}%"></i></div>
              <span class="mono" style="font-size:13px">${prog.pct}%</span>
            </div>
          </div>
          <div class="pstat">
            <span class="pstat-label">Tasks</span>
            <span class="pstat-num mono">${prog.done}<span style="color:var(--ink-4)">/${prog.total}</span></span>
          </div>
          <div class="pstat">
            <span class="pstat-label">Milestones</span>
            <span class="pstat-num mono">${msList.filter((m) => store.milestoneProgress(p.id, m.id).pct === 100).length}<span style="color:var(--ink-4)">/${msList.length}</span></span>
          </div>
          <div class="pstat">
            <span class="pstat-label">Deadline</span>
            <span class="pstat-num mono" style="font-size:15px">${U.fmtDate(p.deadline, "short")}</span>
            <span class="pstat-note ${days <= 3 ? "warning" : ""}">${days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `${days} days left`}</span>
          </div>
        </div>

        <div class="split">
          <div class="stack gap-5">
            ${msList.length ? msList.map((m, mi) => {
              const mp = store.milestoneProgress(p.id, m.id);
              const mt = tasks.filter((t) => t.milestoneId === m.id);
              const open = mi === 0;
              return `
                <section class="panel ms-panel">
                  <div class="ms-head">
                    <button class="ms-toggle" data-toggle-ms aria-expanded="${open}">
                      <span class="ms-num serif">${String(mi + 1).padStart(2, "0")}</span>
                      <span class="grow">
                        <span class="ms-title">${esc(m.title)}</span>
                        <span class="ms-meta mono">${mp.done}/${mp.total} done · due ${U.fmtDate(m.due, "short")}</span>
                      </span>
                      <span class="row gap-3" style="flex:none">
                        <span style="width:70px">${ui.meter(mp.pct, p.color)}</span>
                        <span class="ms-chev">${icon(open ? "chevron-down" : "chevron-right")}</span>
                      </span>
                    </button>
                  </div>
                  <div class="ms-body" ${open ? "" : "hidden"}>
                    ${mt.length ? mt.map((t) => ui.taskRow(t, { showDate: true, showTime: false })).join("") : `
                      <div class="empty" style="padding:24px"><p>No tasks in this milestone yet.</p></div>`}
                    <div class="ms-add">
                      <button class="btn btn-ghost btn-sm" data-add-ms-task="${m.id}">${icon("plus")} Add a task here</button>
                    </div>
                  </div>
                </section>`;
            }).join("") : `
              <div class="panel">${ui.emptyState("No milestones", "Draft a plan to break this project into milestones, or add them by hand.",
                `<div class="row gap-2"><a class="btn btn-sm" href="#/goal?project=${p.id}">${icon("sparkles")} Draft a plan</a>
                 <button class="btn btn-sm" id="w-add-ms">${icon("plus")} Add milestone</button></div>`)}</div>`}

            ${tasks.filter((t) => !t.milestoneId).length ? `
              <section class="panel">
                <div class="panel-head"><h2>Unsorted tasks</h2><span class="meta">${tasks.filter((t) => !t.milestoneId).length}</span></div>
                <div class="rows">${tasks.filter((t) => !t.milestoneId).map((t) => ui.taskRow(t, { showDate: true, showTime: false })).join("")}</div>
              </section>` : ""}
          </div>

          <aside class="rail-stack">
            <section class="panel">
              <div class="panel-head"><h2>Notes</h2><a class="btn btn-ghost btn-sm" href="#/notes">All</a></div>
              <div class="rows">
                ${notes.length ? notes.map((n) => `
                  <a class="row-item" href="#/notes?note=${n.id}">
                    <span style="color:var(--ink-3)">${icon("notes")}</span>
                    <div class="grow"><div class="row-title" style="font-size:12.5px">${esc(n.title)}</div>
                    <div class="row-meta">${esc((n.tags || []).join(" · "))}</div></div>
                  </a>`).join("") : `<div class="empty" style="padding:22px"><p>No notes linked yet.</p>
                    <a class="btn btn-sm" href="#/notes">${icon("plus")} Write one</a></div>`}
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Timeline</h2><span class="meta">${msList.length} gates</span></div>
              <div class="panel-body">
                <ol class="mini-timeline">
                  ${msList.map((m) => {
                    const mp = store.milestoneProgress(p.id, m.id);
                    return `<li class="${mp.pct === 100 ? "is-done" : ""}">
                      <span class="mt-dot" style="--tone:var(--p-${p.color})"></span>
                      <span class="mt-title">${esc(m.title)}</span>
                      <span class="mono mt-date">${U.fmtDate(m.due, "short")}</span>
                    </li>`;
                  }).join("")}
                </ol>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Details</h2></div>
              <div class="panel-body">
                <dl class="def" style="grid-template-columns:90px 1fr">
                  <dt>Created</dt><dd>${U.fmtDate(p.createdAt, "short")}</dd>
                  <dt>Deadline</dt><dd>${U.fmtDate(p.deadline, "medium")}</dd>
                  <dt>Status</dt><dd>${archived ? "Archived" : "Active"}</dd>
                  <dt>Colour</dt><dd><span class="pdot" style="--tone:var(--p-${p.color})"></span> ${p.color}</dd>
                </dl>
              </div>
            </section>
          </aside>
        </div>
      </div>`;

    ui.bind(main, {});

    const rerender = () => renderWorkspace(main, params);
    main.querySelector("#w-add-task").addEventListener("click", () => ui.quickAddTask(U.todayISO(), { projectId: p.id }, rerender));
    main.querySelectorAll("[data-add-ms-task]").forEach((b) => b.addEventListener("click", () =>
      ui.quickAddTask(U.todayISO(), { projectId: p.id, milestoneId: b.dataset.addMsTask }, rerender)));
    main.querySelectorAll("[data-toggle-ms]").forEach((btn) => btn.addEventListener("click", () => {
      const body = btn.closest(".ms").querySelector(".ms-body");
      const open = body.hasAttribute("hidden");
      if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", String(open));
      btn.querySelector(".ms-chev").innerHTML = icon(open ? "chevron-down" : "chevron-right");
    }));
    main.querySelector("#w-add-ms")?.addEventListener("click", () => addMilestoneModal(p.id, rerender));
    main.querySelector("#w-menu").addEventListener("click", (e) => {
      ui.menu(e.currentTarget, [
        { icon: "edit", label: "Edit details", onClick: () => projectModal(p, rerender) },
        { icon: "layers", label: "Add milestone", onClick: () => addMilestoneModal(p.id, rerender) },
        "-",
        { icon: "archive", label: archived ? "Restore project" : "Archive project", onClick: () => {
          store.actions.archiveProject(p.id);
          ui.toast(archived ? "Project restored." : "Project archived. Nothing deleted.");
          rerender();
        }},
        { icon: "trash", label: "Delete project", danger: true, onClick: async () => {
          const ok = await ui.confirm({
            title: "Delete this project?",
            body: `“${p.name}” and its ${store.tasksOfProject(p.id).length} tasks will be removed. Notes stay, unlinked. This cannot be undone.`,
            confirmLabel: "Delete permanently",
            danger: true,
          });
          if (!ok) return;
          store.actions.deleteProject(p.id);
          ui.toast("Project deleted.");
          location.hash = "#/projects";
        }},
      ]);
    });
  }

  function addMilestoneModal(projectId, onDone) {
    const p = store.project(projectId);
    ui.modal({
      title: "Add milestone",
      sub: "A gate, not a task. Tasks hang from it.",
      body: `
        <div class="stack gap-4">
          <div class="field"><label class="label" for="ms-name">Milestone</label>
            <input class="input" id="ms-name" placeholder="e.g. Case studies finished" autofocus /></div>
          <div class="field"><label class="label" for="ms-due">Due</label>
            <input class="input" type="date" id="ms-due" value="${p.deadline}" /></div>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="ms-save">Add milestone</button>`,
      onMount: (el, close) => {
        el.querySelector("#ms-save").addEventListener("click", () => {
          const name = el.querySelector("#ms-name").value.trim();
          if (!name) { ui.toast("Name the milestone.", { kind: "danger" }); return; }
          store.actions.addMilestone(projectId, name, el.querySelector("#ms-due").value);
          close();
          ui.toast("Milestone added.");
          onDone && onDone();
        });
      },
    });
  }

  POS.views = POS.views || {};
  POS.views.projects = {
    render(main, params) {
      if (params.id) renderWorkspace(main, params);
      else renderList(main);
    },
  };
  POS.views.projects.renderList = renderList;
})();
