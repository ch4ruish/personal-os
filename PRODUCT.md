# Personal OS — Product

**One line:** A second brain that turns what you say you want into a schedule you can actually keep.

**Promise:** It doesn't just remember what you want to do. It figures out how you can get it done.

## Who it's for

One person, working alone: a designer, student or independent maker with several live goals
(portfolio, client work, applications) and no project manager. They think in paragraphs, not
fields. They open the app in the morning to decide what matters, and in the evening to close
the loop.

## The loop

CAPTURE → UNDERSTAND → BREAK DOWN → ORGANISE → SCHEDULE → EXECUTE → TRACK → ADAPT

1. **Capture** — one free-text box, voice or file. No forms.
2. **Understand** — the assistant proposes tasks, goals, projects, notes, dates. Everything is
   editable before it is saved.
3. **Break down** — a goal becomes milestones, milestones become tasks with estimates and
   dependencies, and a draft schedule.
4. **Schedule** — drafts land on the calendar as *proposed*, never as fact. Approve, edit, or
   reject, per item.
5. **Execute** — Today, Focus Mode, habits.
6. **Adapt** — missed work produces a rescheduling proposal with an impact summary; nothing
   moves until the user approves.

## Rules the product keeps

- The assistant proposes; the user decides. No silent edits, moves or deletes.
- Proposed and existing are visually distinct, always.
- Every control does what it says. No decorative buttons.
- The AI is a **local, deterministic demo** in this build. No model is called, no key is used.
  The UI says so where it matters.
- Integrations (calendar sync, cloud backup) are shown as **not connected**. They are labelled,
  not faked.
- Data lives in the browser (localStorage). Export and import are real; nothing leaves the device.
- Offline-first: the app runs from disk with no network. Fonts are self-hosted.

## Screens

Today · Brain Dump · Goal Breakdown · Projects · Calendar · Daily Planner · Notifications ·
Focus · Rescheduling · Notes · Habits · Reflection · Settings

## Scope of this build

Frontend only, with a structured mock service layer (`js/ai.js`) and seeded sample data. The
mock layer is deliberately isolated so a real backend or model can replace it without touching
views.
