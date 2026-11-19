/* Notes — connected writing, not a filing cabinet. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const state = { selectedId: null, q: "", tag: "all" };

  const tagsOf = (note) => (note.tags || []).filter(Boolean);

  function noteListHTML(notes) {
    const allTags = [...new Set(notes.flatMap(tagsOf))].sort();
    const q = state.q.trim().toLowerCase();
    const filtered = notes
      .filter((n) => state.tag === "all" || tagsOf(n).includes(state.tag))
      .filter((n) => !q || (n.title + " " + n.body + " " + tagsOf(n).join(" ")).toLowerCase().includes(q))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    return `
      <div class="notes-list-panel panel">
        <div class="notes-list-head">
          <div class="search-field notes-search">
            ${icon("search", "ico-sm")}
            <input id="notes-q" placeholder="Search notes" aria-label="Search notes" value="${esc(state.q)}" />
          </div>
          <button class="icon-btn" id="notes-new" aria-label="New note" title="New note">${icon("plus")}</button>
        </div>
        <div class="notes-tags">
          <button class="chip chip-sm" data-tag="all" aria-pressed="${state.tag === "all"}">All <span class="mono">${notes.length}</span></button>
          ${allTags.map((t) => `<button class="chip chip-sm" data-tag="${esc(t)}" aria-pressed="${state.tag === t}">${esc(t)}</button>`).join("")}
        </div>
        <div class="notes-rows">
          ${filtered.length ? filtered.map((n) => `
            <button class="notes-row ${n.id === state.selectedId ? "is-active" : ""}" data-note="${n.id}">
              <span class="notes-row-title ${noteIsEmpty(n) ? "is-muted" : ""}">${esc(n.title || "Untitled note")}</span>
              <span class="notes-row-body">${esc((n.body || "No text yet").replace(/\n/g, " ").slice(0, 72))}</span>
              <span class="notes-row-meta">
                <span class="mono">${U.relDate(n.updatedAt || n.createdAt)}</span>
                ${n.projectId ? `<span class="sep">·</span><span>${esc((store.project(n.projectId) || {}).name || "Project")}</span>` : ""}
                ${tagsOf(n).length ? `<span class="sep">·</span><span>${esc(tagsOf(n)[0])}</span>` : ""}
              </span>
            </button>`).join("") : `<div class="empty" style="padding:28px 16px"><p>${notes.length ? "No note matches this search." : "No notes yet. Write the first one."}</p></div>`}
        </div>
        <div class="notes-list-foot mono">${filtered.length} of ${notes.length} notes</div>
      </div>`;
  }

  function noteIsEmpty(n) {
    return !(n.body || "").trim() && n.title === "Untitled note";
  }

  function tasksSection(note) {
    const linked = store.tasksForNote(note);
    const projectTasks = note.projectId ? store.tasksOfProject(note.projectId).filter((t) => note.taskIds.includes(t.id)) : [];
    return { linked, projectTasks };
  }

  function editorHTML(note) {
    const st = store.get();
    const projects = st.projects.filter((p) => p.status !== "archived");
    const { linked } = tasksSection(note);
    const related = store.relatedNotes(note);
    const words = U.wordCount(note.body || "");
    return `
      <div class="notes-editor panel" data-note-editor="${note.id}">
        <div class="notes-editor-top">
          <input class="note-title-input serif" id="note-title" value="${esc(note.title)}" placeholder="Untitled note" aria-label="Note title" />
          <div class="row gap-1">
            ${window.SpeechRecognition || window.webkitSpeechRecognition
              ? `<button class="icon-btn" id="note-mic" aria-label="Dictate into the note" title="Dictate">${icon("mic")}</button>` : ""}
            <button class="icon-btn" id="note-more" aria-label="Note actions" aria-haspopup="menu" title="More">${icon("more")}</button>
          </div>
        </div>
        <div class="notes-editor-meta">
          <span class="mono">${words} WORD${words === 1 ? "" : "S"}</span>
          <span class="sep">·</span>
          <span class="mono">EDITED ${U.relDate(note.updatedAt || note.createdAt).toUpperCase()}</span>
          <span class="sep">·</span>
          <span class="save-state" id="save-state">Saved locally</span>
        </div>

        <div class="notes-fields">
          <div class="field">
            <label class="label" for="note-body">Note</label>
            <textarea class="note-body" id="note-body" placeholder="Start with the thing you do not want to lose.">${esc(note.body)}</textarea>
          </div>
        </div>

        <div class="notes-props">
          <div class="field">
            <label class="label" for="note-tags">Tags</label>
            <input class="input" id="note-tags" value="${esc(tagsOf(note).join(", "))}" placeholder="e.g. portfolio, writing" />
            <span class="field-help">Comma separated. Tags connect related notes.</span>
          </div>
          <div class="field">
            <label class="label" for="note-project">Project</label>
            <select class="select" id="note-project">
              <option value="">Not linked</option>
              ${projects.map((p) => `<option value="${p.id}" ${p.id === note.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="note-links-block">
          <div class="spread">
            <h3>TASKS</h3>
            <button class="btn btn-ghost btn-sm" id="note-link-task">${icon("link")} Link a task</button>
          </div>
          <div class="note-link-list">
            ${linked.length ? linked.map((t) => `
              <div class="note-linked-task">
                <label class="check ${t.done ? "is-done" : ""}">
                  <input type="checkbox" ${t.done ? "checked" : ""} data-act="toggle-task" data-id="${t.id}" aria-label="Complete ${esc(t.title)}" />
                  <span class="check-label grow"><span class="note-task-title">${esc(t.title)}</span></span>
                </label>
                <span class="mono" style="font-size:10px;color:var(--ink-3)">${U.relDate(t.date)}</span>
                <button class="icon-btn icon-btn-sm" data-unlink-task="${t.id}" aria-label="Unlink ${esc(t.title)}">${icon("close")}</button>
              </div>`).join("") : `<p class="note-links-empty">No tasks linked. A note can hold the thinking behind a piece of work.</p>`}
          </div>
        </div>

        <div class="note-links-block">
          <div class="spread">
            <h3>ATTACHMENTS</h3>
            <button class="btn btn-ghost btn-sm" id="note-attach">${icon("paperclip")} Attach</button>
            <input type="file" id="note-file" multiple hidden />
          </div>
          <div class="note-link-list">
            ${(note.attachments || []).length ? note.attachments.map((a, i) => `
              <div class="note-attachment">
                ${icon("paperclip", "ico-sm")}
                <span class="grow truncate">${esc(a.name)}</span>
                <span class="mono" style="font-size:10px;color:var(--ink-4)">${esc(a.size || "")}</span>
                <button class="icon-btn icon-btn-sm" data-remove-attachment="${i}" aria-label="Remove ${esc(a.name)}">${icon("close")}</button>
              </div>`).join("") : `<p class="note-links-empty">Nothing attached. In this build only the file name is kept — file contents stay on your disk.</p>`}
          </div>
        </div>

        ${related.length ? `
        <div class="note-related">
          <h3>RELATED BY TAG</h3>
          <div class="note-related-list">
            ${related.map((r) => `<a class="note-related-row" href="#/notes?note=${r.id}">
              <span class="grow"><span class="note-related-title">${esc(r.title)}</span>
              <span class="note-related-meta">${esc(tagsOf(r).join(" · "))}</span></span>
              ${icon("arrow-right", "ico-sm")}
            </a>`).join("")}
          </div>
        </div>` : ""}
      </div>`;
  }

  function render(main, params = {}) {
    const st = store.get();
    const notes = st.notes.slice();
    if (params.note) state.selectedId = params.note;
    if (!state.selectedId || !notes.some((n) => n.id === state.selectedId)) {
      state.selectedId = notes.length ? notes.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0].id : null;
    }
    const note = state.selectedId ? store.note(state.selectedId) : null;

    main.innerHTML = `
      <div class="page notes-page">
        <header class="page-head">
          <div>
            <h1 class="page-title">Notes</h1>
            <div class="page-sub">
              <span>${notes.length} notes</span>
              <span class="dot-sep">·</span>
              <span>${new Set(notes.flatMap(tagsOf)).size} tags</span>
              <span class="dot-sep">·</span>
              <span>Stored in this browser</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" data-act="assistant">${icon("sparkles")} Ask about notes</button>
            <button class="btn btn-primary" id="notes-new-top">${icon("plus")} New note</button>
          </div>
        </header>

        ${notes.length ? `
        <div class="notes-layout">
          ${noteListHTML(notes)}
          <div class="notes-editor-wrap">
            ${note ? editorHTML(note) : ui.emptyState("Select a note", "Pick something from the list, or start a new one.")}
          </div>
        </div>` : `<div class="panel">${ui.emptyState(
          "A blank page, on purpose",
          "Notes are for the thinking that does not fit in a task: a positioning statement, a client call, the reason behind a decision.",
          `<button class="btn btn-primary btn-sm" id="notes-new-empty">${icon("plus")} Write the first note</button>`
        )}</div>`}
      </div>`;

    const newNote = () => {
      const n = store.actions.addNote({ title: "Untitled note", body: "", tags: [], projectId: null, taskIds: [], attachments: [] });
      state.selectedId = n.id;
      location.hash = "#/notes?note=" + n.id;
    };
    main.querySelector("#notes-new")?.addEventListener("click", newNote);
    main.querySelector("#notes-new-top").addEventListener("click", newNote);
    main.querySelector("#notes-new-empty")?.addEventListener("click", newNote);

    main.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", () => {
      state.selectedId = b.dataset.note;
      location.hash = "#/notes?note=" + b.dataset.note;
    }));
    main.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => {
      state.tag = b.dataset.tag;
      render(main);
    }));
    const qInput = main.querySelector("#notes-q");
    qInput?.addEventListener("input", () => {
      state.q = qInput.value;
      const list = main.querySelector(".notes-rows");
      const filtered = notes
        .filter((n) => state.tag === "all" || tagsOf(n).includes(state.tag))
        .filter((n) => !state.q.trim() || (n.title + " " + n.body + " " + tagsOf(n).join(" ")).toLowerCase().includes(state.q.trim().toLowerCase()))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      list.innerHTML = filtered.length ? filtered.map((n) => `
        <button class="notes-row ${n.id === state.selectedId ? "is-active" : ""}" data-note="${n.id}">
          <span class="notes-row-title">${esc(n.title || "Untitled note")}</span>
          <span class="notes-row-body">${esc((n.body || "No text yet").replace(/\n/g, " ").slice(0, 72))}</span>
          <span class="notes-row-meta"><span class="mono">${U.relDate(n.updatedAt || n.createdAt)}</span></span>
        </button>`).join("") : `<div class="empty" style="padding:28px 16px"><p>No note matches “${esc(state.q)}”.</p></div>`;
      list.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", () => {
        state.selectedId = b.dataset.note;
        location.hash = "#/notes?note=" + b.dataset.note;
      }));
    });

    if (!note) return;

    const title = main.querySelector("#note-title");
    const body = main.querySelector("#note-body");
    const tags = main.querySelector("#note-tags");
    const projectSel = main.querySelector("#note-project");
    const saveState = main.querySelector("#save-state");

    const markSaved = () => {
      if (!saveState) return;
      saveState.textContent = "Saved locally";
      saveState.classList.add("is-saved");
      setTimeout(() => saveState.classList.remove("is-saved"), 900);
    };
    const save = U.debounce((patch) => {
      store.actions.updateNote(note.id, patch);
      markSaved();
    }, 400);

    title.addEventListener("input", () => {
      save({ title: title.value });
      const active = main.querySelector(".notes-row.is-active .notes-row-title");
      if (active) active.textContent = title.value || "Untitled note";
    });
    body.addEventListener("input", () => {
      save({ body: body.value });
      const meta = main.querySelector(".notes-editor-meta .mono");
      if (meta) meta.textContent = `${U.wordCount(body.value)} WORDS`;
    });
    tags.addEventListener("input", () => {
      save({ tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean) });
    });
    projectSel.addEventListener("change", () => {
      store.actions.updateNote(note.id, { projectId: projectSel.value || null });
      ui.toast("Project link updated.");
    });

    main.querySelector("#note-mic")?.addEventListener("click", () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;
      const rec = new SR();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = false;
      rec.onresult = (ev) => {
        const said = Array.from(ev.results).map((r) => r[0].transcript).join(" ");
        body.value = (body.value ? body.value + "\n\n" : "") + said;
        save({ body: body.value });
        ui.toast("Dictation added to the note.");
      };
      rec.onerror = () => ui.toast("Dictation stopped. You can type instead.", { kind: "danger" });
      rec.start();
      ui.toast("Listening. Speak, then pause.");
    });

    main.querySelector("#note-more").addEventListener("click", (e) => {
      ui.menu(e.currentTarget, [
        { icon: "tasks", label: "Link tasks", onClick: () => linkTasks(note, () => render(main, { note: note.id })) },
        { icon: "paperclip", label: "Attach a file", onClick: () => main.querySelector("#note-file").click() },
        "-",
        {
          icon: "trash", label: "Delete note", danger: true, onClick: async () => {
            const ok = await ui.confirm({
              title: "Delete this note?",
              body: `“${note.title}” will be removed. Linked tasks and projects keep existing; only the note goes.`,
              confirmLabel: "Delete note",
              danger: true,
            });
            if (!ok) return;
            store.actions.deleteNote(note.id);
            state.selectedId = null;
            location.hash = "#/notes";
            ui.toast("Note deleted.");
          },
        },
      ]);
    });

    main.querySelector("#note-link-task")?.addEventListener("click", () => linkTasks(note, () => render(main, { note: note.id })));
    main.querySelectorAll("[data-unlink-task]").forEach((b) => b.addEventListener("click", () => {
      store.actions.updateNote(note.id, { taskIds: note.taskIds.filter((id) => id !== b.dataset.unlinkTask) });
      ui.toast("Task unlinked.");
    }));

    main.querySelector("#note-attach").addEventListener("click", () => main.querySelector("#note-file").click());
    main.querySelector("#note-file").addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []).map((f) => ({
        name: f.name,
        size: f.size > 1024 ? Math.round(f.size / 1024) + " KB" : f.size + " B",
      }));
      if (!files.length) return;
      store.actions.updateNote(note.id, { attachments: (note.attachments || []).concat(files) });
      ui.toast(files.length === 1 ? "File name attached." : `${files.length} file names attached.`, {
        duration: 5000,
      });
    });
    main.querySelectorAll("[data-remove-attachment]").forEach((b) => b.addEventListener("click", () => {
      store.actions.updateNote(note.id, {
        attachments: note.attachments.filter((_, i) => i !== Number(b.dataset.removeAttachment)),
      });
    }));

    ui.bind(main, {});
  }

  function linkTasks(note, onDone) {
    const open = store.openTasks()
      .sort((a, b) => {
        if (a.projectId === note.projectId && b.projectId !== note.projectId) return -1;
        if (b.projectId === note.projectId && a.projectId !== note.projectId) return 1;
        return a.date.localeCompare(b.date);
      })
      .slice(0, 30);
    const chosen = new Set(note.taskIds || []);
    const m = ui.modal({
      title: "Link tasks",
      sub: "A note can hold the reasoning behind several pieces of work.",
      body: `
        <div class="link-task-list">
          ${open.length ? open.map((t) => {
            const p = t.projectId ? store.project(t.projectId) : null;
            return `<label class="link-task-row">
              <input type="checkbox" data-link="${t.id}" ${chosen.has(t.id) ? "checked" : ""} />
              <span class="grow"><span class="link-task-title">${esc(t.title)}</span>
              <span class="link-task-meta">${p ? esc(p.name) : "Personal"} · ${U.relDate(t.date)}</span></span>
            </label>`;
          }).join("") : `<p class="note-links-empty">No open tasks to link.</p>`}
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="link-save">Save links</button>`,
      onMount: (el, close) => {
        el.querySelectorAll("[data-link]").forEach((cb) => cb.addEventListener("change", () => {
          if (cb.checked) chosen.add(cb.dataset.link); else chosen.delete(cb.dataset.link);
        }));
        el.querySelector("#link-save").addEventListener("click", () => {
          store.actions.updateNote(note.id, { taskIds: [...chosen] });
          close();
          ui.toast("Task links updated.");
          onDone && onDone();
        });
      },
    });
    return m;
  }

  POS.views = POS.views || {};
  POS.views.notes = { render };
})();
