const ChoreyApp = (() => {
  const { getPerson, escapeHTML } = ChoreyUtils;
  const { profileRepository, taskRepository, occurrenceRepository, dailyRepository } = ChoreyRepositories;
  const POLL = 60000;

  let activeDayData = null;
  let currentTasks = [];
  let currentStates = {};
  let currentView = "today";
  let refreshing = false;
  let congrats = false;
  let lastViewportMarkup = null;
  let lastViewportView = null;
  let resumeRefreshTimer = null;

  async function active() {
    return getPerson(await profileRepository.getActivePersonId());
  }

  function banner(message) {
    document.querySelector(".connection-banner")?.remove();
    if (!message) return;
    const element = document.createElement("div");
    element.className = "connection-banner";
    element.innerHTML = `<span>${escapeHTML(message)}</span><button class="connection-retry">Retry</button>`;
    document.querySelector(".container")?.prepend(element);
    element.querySelector("button").onclick = () => init();
  }

  async function loadTasks() {
    let tasks = await taskRepository.getAll();
    if (!tasks.length) {
      await taskRepository.seedDefaults(defaultTasks);
      tasks = await taskRepository.getAll();
    }
    return tasks;
  }

  function defaultState(task) {
    return ChoreyTaskModel.normalizeOccurrence({ selfAssignedIds: [], isDone: false }, task);
  }

  function visibleOccurrences(day, states) {
    return day.occurrences.filter(item => !(
      item.occurrence.duration === "indefinite" &&
      states[item.id]?.isDone &&
      states[item.id]?.completedAt?.slice(0, 10) !== day.dateKey
    ));
  }

  function defaultViewMode(person) {
    return person.isOwner ? "household" : "mine";
  }

  function allowedViewModes(person) {
    if (person.isOwner) return new Set(["household", "completed"]);
    if (person.isAdmin) return new Set(["mine", "household", "completed"]);
    return new Set(["mine", "unassigned", "completed"]);
  }

  function getViewMode(person) {
    const stored = ChoreyStorage.getViewMode(person.id);
    return allowedViewModes(person).has(stored) ? stored : defaultViewMode(person);
  }

  function setViewMode(person, mode) {
    if (!allowedViewModes(person).has(mode)) return false;
    ChoreyStorage.setViewMode(person.id, mode);
    currentView = "today";
    return true;
  }

  function viewDefinition(person) {
    const mode = getViewMode(person);
    if (person.isOwner) {
      return mode === "completed"
        ? { mode, scope: "household", showCompleted: true, buttonLabel: "View All Tasks", next: "all" }
        : { mode: "household", scope: "household", showCompleted: false, buttonLabel: "Show Completed Tasks", next: "completed" };
    }
    if (person.isAdmin) {
      if (mode === "household") return { mode, scope: "household", showCompleted: false, buttonLabel: "Show Completed Tasks", next: "completed" };
      if (mode === "completed") return { mode, scope: "household", showCompleted: true, buttonLabel: "Show My Due Tasks", next: "mine" };
      return { mode: "mine", scope: "mine", showCompleted: false, buttonLabel: "Show Due Tasks", next: "household" };
    }
    if (mode === "unassigned") return { mode, scope: "mine-unassigned", showCompleted: false, buttonLabel: "Show Completed Tasks", next: "completed" };
    if (mode === "completed") return { mode, scope: "mine-unassigned", showCompleted: true, buttonLabel: "Show My Due Tasks", next: "mine" };
    return { mode: "mine", scope: "mine", showCompleted: false, buttonLabel: "Show Unassigned Tasks", next: "unassigned" };
  }

  async function init({ background = false } = {}) {
    if (refreshing) return;
    refreshing = true;
    try {
      const person = await active();
      const tasks = await loadTasks();
      const day = ChoreyScheduler.buildDayData(tasks, person, ChoreyClock.now());
      const states = await occurrenceRepository.getAll(tasks);
      currentTasks = tasks;
      currentStates = states;
      activeDayData = { ...day, occurrences: visibleOccurrences(day, states) };
      await dailyRepository.prepare(day.dateKey);
      congrats = person ? await dailyRepository.getCongratulationsShown(person.id) : false;
      banner();
      ChoreyUI.updateHeader(person, () => ChoreyTaskCreator.open(person, refresh), {
        title: currentView === "all" ? "All Tasks" : undefined,
      });
      if (!person) {
        currentView = "today";
        renderLogin();
        return;
      }
      if (currentView === "all") renderAll(person);
      else renderToday(person);
    } catch (error) {
      console.error(error);
      banner("Shared chores are unavailable. Check the connection and try again.");
      if (!background && !document.getElementById("app-viewport").innerHTML.trim()) {
        document.getElementById("app-viewport").innerHTML = '<div class="connection-empty">Shared chores unavailable</div>';
      }
    } finally {
      refreshing = false;
    }
  }

  async function refresh() {
    await init({ background: true });
  }

  function renderLogin() {
    lastViewportMarkup = null;
    lastViewportView = "login";
    ChoreyUI.renderLoginScreen(async id => {
      const person = getPerson(id);
      const code = prompt(`Enter passcode for ${person.name}:`);
      if (code === person.passcode) {
        await profileRepository.setActivePersonId(id);
        await init();
      } else if (code !== null) {
        alert("Incorrect profile passcode.");
      }
    });
  }

  function occurrenceItem(item) {
    return { ...item, ...defaultState(item.task), ...(currentStates[item.id] || {}) };
  }

  function allSections(person) {
    const sections = new Map([["unassigned", []], ...people.map(profile => [profile.id, []])]);
    activeDayData.occurrences.forEach(item => {
      const configured = occurrenceItem(item);
      if (configured.task.visibility === "private" && configured.task.createdById !== person.id) return;
      const ids = configured.assignedIds || [];
      if (!ids.length) sections.get("unassigned").push(configured);
      else ids.forEach(id => sections.get(id)?.push(configured));
    });
    return sections;
  }

  function boardFor(person) {
    const definition = viewDefinition(person);
    const source = allSections(person);
    let order;
    if (definition.scope === "mine") order = [person.id];
    else if (definition.scope === "mine-unassigned") order = ["unassigned", person.id];
    else order = ["unassigned", person.id, ...people.filter(profile => profile.id !== person.id).map(profile => profile.id)];

    const counts = new Map(order.map(id => [id, (source.get(id) || []).length]));
    const sections = new Map(order.map(id => [
      id,
      (source.get(id) || []).filter(item => definition.showCompleted || !item.isDone),
    ]));
    return { definition, sections, counts, order };
  }

  function congratulationsItems(person) {
    return activeDayData.occurrences
      .map(occurrenceItem)
      .filter(item => item.task.visibility !== "private")
      .filter(item => item.occurrence.duration === "day" || item.occurrence.closesOn === activeDayData.dateKey)
      .filter(item => person.isOwner || person.isAdmin || (item.assignedIds || []).includes(person.id));
  }

  function bindRows(person, definition) {
    const viewport = document.getElementById("app-viewport");
    viewport.querySelectorAll(".chore-item[data-id]").forEach(row => {
      const id = row.dataset.id;
      const button = row.querySelector(".assignment-button");
      if (button) button.addEventListener("click", event => {
        event.stopPropagation();
        manageAssignment(id, person);
      });
      const checkbox = row.querySelector(".chore-checkbox");
      checkbox?.addEventListener("click", event => event.stopPropagation());
      checkbox?.addEventListener("change", async event => {
        const wanted = event.target.checked;
        try {
          if (!await toggle(id, wanted, person)) event.target.checked = !wanted;
        } catch (error) {
          event.target.checked = !wanted;
          banner("The completion was not changed.");
        }
      });
    });
    viewport.querySelectorAll(".swipe-row.can-edit").forEach(row => {
      ChoreySwipe.enableAction(row, { onAction: () => editTask(row.dataset.taskId, person) });
    });
    viewport.querySelector("#view-mode-button")?.addEventListener("click", () => {
      if (definition.next === "all") {
        ChoreyStorage.setViewMode(person.id, "household");
        currentView = "all";
        init();
        return;
      }
      setViewMode(person, definition.next);
      init();
    });
  }

  async function renderToday(person) {
    const due = congratulationsItems(person);
    if (due.length && due.every(item => item.isDone) && !congrats) {
      congrats = true;
      await dailyRepository.setCongratulationsShown(person.id, true);
      ChoreyUI.showCongratulations();
    }

    document.getElementById("date-subheading").textContent = activeDayData.displayDate;
    const viewport = document.getElementById("app-viewport");
    const board = boardFor(person);
    const hasRows = [...board.counts.values()].some(count => count > 0);
    const markup = hasRows
      ? ChoreyUI.renderBoard(person, activeDayData, board.sections, {
          order: board.order,
          counts: board.counts,
          buttonLabel: board.definition.buttonLabel,
        })
      : ChoreyUI.emptyDayMarkup(board.definition.buttonLabel);

    if (lastViewportView === "today" && lastViewportMarkup === markup) return;
    ChoreySwipe.resetOpenRow();
    viewport.innerHTML = markup;
    lastViewportView = "today";
    lastViewportMarkup = markup;
    bindRows(person, board.definition);
  }

  function renderAll(person) {
    if (!person.isOwner) {
      currentView = "today";
      init();
      return;
    }
    document.getElementById("date-subheading").textContent = "Task Library";
    const viewport = document.getElementById("app-viewport");
    const markup = ChoreyUI.renderAllTasks(currentTasks, person);
    if (lastViewportView === "all" && lastViewportMarkup === markup) return;
    ChoreySwipe.resetOpenRow();
    viewport.innerHTML = markup;
    lastViewportView = "all";
    lastViewportMarkup = markup;
    viewport.querySelectorAll(".swipe-row.can-edit").forEach(row => {
      ChoreySwipe.enableAction(row, { onAction: () => editTask(row.dataset.taskId, person) });
    });
    viewport.querySelector("#back-to-today").textContent = "Show Due Tasks";
    viewport.querySelector("#back-to-today").onclick = () => {
      setViewMode(person, "household");
      currentView = "today";
      init();
    };
  }

  async function editTask(id, person) {
    const task = currentTasks.find(item => item.id === id);
    if (task && ChoreyTaskModel.canEditTask(person, task)) {
      await ChoreyTaskCreator.open(person, refresh, task);
    }
  }

  async function manageAssignment(id, person) {
    const item = activeDayData.occurrences.find(entry => entry.id === id);
    if (!item || item.task.visibility === "private") return;
    const state = currentStates[id] || defaultState(item.task);
    if (!ChoreyTaskModel.canManageAssignments(person)) {
      if (!state.assignedIds.length) {
        state.assignedIds = [person.id];
        state.selfAssignedIds = [person.id];
        state.assignedById = person.id;
        state.assignmentType = "temporary";
        await occurrenceRepository.set(id, state, item.task);
      } else if (state.selfAssignedIds?.includes(person.id)) {
        await occurrenceRepository.delete(id);
      } else return;
      return refresh();
    }
    openAssignmentModal(item, state, person);
  }

  function openAssignmentModal(item, state, person) {
    const overlay = document.createElement("div");
    overlay.className = "assignment-overlay";
    let shared = false;
    let selected = new Set(state.assignedIds || []);
    const assignable = people;
    let holdTimer = null;
    let held = false;

    function holdAction(element, action) {
      const cancelHold = () => {
        clearTimeout(holdTimer);
        element.classList.remove("holding");
      };
      element.addEventListener("pointerdown", event => {
        if (event.button !== undefined && event.button !== 0) return;
        held = false;
        element.classList.add("holding");
        holdTimer = setTimeout(() => {
          held = true;
          element.classList.remove("holding");
          action(true);
          navigator.vibrate?.(25);
        }, 700);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(type => element.addEventListener(type, cancelHold));
      element.addEventListener("click", event => {
        event.stopPropagation();
        if (!held) action(false);
        held = false;
        element.classList.remove("holding");
      });
    }

    function draw() {
      const enough = selected.size > 1;
      overlay.innerHTML = `<div class="assignment-modal-card"><div class="assignment-modal-title">Assign Task</div><ul class="chore-list">${assignable.map(profile => `<li class="chore-item profile-card hold-assign-button${selected.has(profile.id) ? " current-selection" : ""}" data-person="${profile.id}" style="--person-accent:${profile.accent}"><span class="hold-assign-progress"></span><span class="chore-title hold-assign-label">${escapeHTML(profile.name)}</span></li>`).join("")}</ul><button class="secondary-button" data-unassign>Unassigned</button><button class="modal-cancel">Cancel</button><button class="shared-task-button${shared ? " selected" : ""}" data-confirm ${shared && !enough ? "disabled" : ""}>${shared ? "Confirm" : "Shared Task"}</button></div>`;
      overlay.querySelectorAll("[data-person]").forEach(row => {
        if (shared) row.addEventListener("click", () => {
          selected.has(row.dataset.person) ? selected.delete(row.dataset.person) : selected.add(row.dataset.person);
          draw();
        });
        else holdAction(row, permanent => apply([row.dataset.person], permanent));
      });
      const confirm = overlay.querySelector("[data-confirm]");
      if (!shared) confirm.onclick = () => {
        shared = true;
        selected.clear();
        draw();
      };
      else if (!confirm.disabled) holdAction(confirm, permanent => apply([...selected], permanent));
      holdAction(overlay.querySelector("[data-unassign]"), permanent => apply([], permanent));
      overlay.querySelector(".modal-cancel").onclick = () => overlay.remove();
    }

    async function apply(ids, permanent) {
      try {
        if (permanent) {
          const task = { ...item.task, defaultAssignedIds: ids };
          await taskRepository.update(task);
          await occurrenceRepository.delete(item.id);
        } else {
          const next = {
            ...state,
            assignedIds: ids,
            assignmentOverride: true,
            selfAssignedIds: [],
            assignedById: person.id,
            assignmentType: "temporary",
            assignmentSource: "manual",
            isDone: false,
            completedById: null,
            completedAt: null,
          };
          await occurrenceRepository.set(item.id, next, item.task);
        }
        overlay.remove();
        await refresh();
      } catch (error) {
        console.error(error);
        banner("The assignment was not changed.");
      }
    }

    document.body.appendChild(overlay);
    draw();
  }

  async function toggle(id, checked, person) {
    const item = activeDayData.occurrences.find(entry => entry.id === id);
    if (!item) return false;
    const state = currentStates[id] || defaultState(item.task);
    const assigned = state.assignedIds || [];
    if (checked) {
      if (assigned.length && !assigned.includes(person.id) && !person.isOwner && !person.isAdmin) return false;
      const next = { ...state, isDone: true, completedById: person.id, completedAt: new Date().toISOString() };
      if (!assigned.length && item.task.visibility !== "private") {
        next.assignedIds = [person.id];
        next.assignmentOverride = true;
        next.selfAssignedIds = [person.id];
        next.assignedById = person.id;
        next.assignmentType = "temporary";
        next.assignmentSource = "completion";
      }
      await occurrenceRepository.set(id, next, item.task);
    } else {
      const worker = getPerson(state.completedById);
      if (!(state.completedById === person.id || person.isOwner || (person.isAdmin && !worker?.isOwner))) return false;
      if (state.assignmentSource === "completion" && !(item.task.defaultAssignedIds || []).length) {
        await occurrenceRepository.delete(id);
      } else {
        const next = { ...state, isDone: false, completedById: null, completedAt: null };
        await occurrenceRepository.set(id, next, item.task);
      }
      congrats = false;
      await dailyRepository.setCongratulationsShown(person.id, false);
    }
    await refresh();
    return true;
  }

  const date = document.getElementById("date-subheading");
  let hold;
  let dateHeld = false;

  function openDeveloperMenu() {
    document.querySelector(".developer-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "developer-overlay";
    const simulated = ChoreyClock.now().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    overlay.innerHTML = `<div class="developer-modal-card" role="dialog" aria-modal="true" aria-label="Developer menu"><div class="developer-modal-title">Developer</div><div class="developer-version">Chorey v${escapeHTML(CHOREY_APP_VERSION)}</div><div class="developer-date-status">Scheduler date: ${escapeHTML(simulated)}</div><button class="developer-menu-button danger" data-dev-action="reset-shared">Reset Default Task List</button><button class="developer-menu-button danger" data-dev-action="reset-local">Reset Local Data</button><div class="developer-menu-label">Time Travel</div><button class="developer-menu-button" data-dev-action="tomorrow">Tomorrow</button><button class="developer-menu-button" data-dev-action="week">Next Week</button><button class="developer-menu-button" data-dev-action="month">Next Month</button><button class="developer-menu-button" data-dev-action="today" ${ChoreyClock.isOverridden() ? "" : "disabled"}>Return to Today</button><button class="developer-menu-button cancel" data-dev-action="cancel">Cancel</button></div>`;
    document.body.appendChild(overlay);
    overlay.onclick = async event => {
      const action = event.target.closest("[data-dev-action]")?.dataset.devAction;
      if (!action) {
        if (event.target === overlay) overlay.remove();
        return;
      }
      if (action === "cancel") { overlay.remove(); return; }
      if (action === "reset-local") {
        if (!confirm("Reset local settings and uncheck every current task? Temporary assignments will also be cleared.")) return;
        try {
          await occurrenceRepository.resetAll();
          ChoreyStorage.resetAllData();
          location.reload();
        } catch (error) {
          console.error(error);
          alert("Chorey could not reset the current task state. Check the connection and try again.");
        }
        return;
      }
      if (action === "reset-shared") {
        const owner = await active();
        if (!owner?.isOwner) return;
        const passcode = prompt("Enter the Owner passcode to reset the shared task list:");
        if (passcode === null) return;
        if (passcode !== owner.passcode) { alert("Incorrect Owner passcode."); return; }
        if (!confirm("Reset the shared task list to the current hardcoded defaults? This permanently deletes every shared task, assignment, and completion.")) return;
        await taskRepository.resetToDefaults(defaultTasks);
        overlay.remove();
        currentView = "today";
        await init();
        return;
      }
      if (action === "tomorrow") ChoreyClock.advanceDays(1);
      if (action === "week") ChoreyClock.advanceDays(7);
      if (action === "month") ChoreyClock.advanceMonth();
      if (action === "today") ChoreyClock.returnToToday();
      overlay.remove();
      currentView = "today";
      await init();
    };
  }

  date.addEventListener("pointerdown", () => {
    dateHeld = false;
    hold = setTimeout(async () => {
      const person = await active();
      if (!person?.isOwner) return;
      dateHeld = true;
      openDeveloperMenu();
    }, 1000);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(type => date.addEventListener(type, () => clearTimeout(hold)));
  date.addEventListener("click", async event => {
    if (dateHeld) {
      event.preventDefault();
      dateHeld = false;
      return;
    }
    currentView = "today";
    await profileRepository.clearActivePerson();
    await init();
  });

  function scheduleResumeRefresh() {
    if (document.hidden || document.querySelector(".assignment-overlay")) return;
    clearTimeout(resumeRefreshTimer);
    resumeRefreshTimer = setTimeout(() => init({ background: true }), 250);
  }
  document.addEventListener("visibilitychange", scheduleResumeRefresh);
  window.addEventListener("focus", scheduleResumeRefresh);
  setInterval(() => {
    if (!document.hidden && !document.querySelector(".assignment-overlay")) init({ background: true });
  }, POLL);

  return Object.freeze({ init });
})();
ChoreyApp.init();
