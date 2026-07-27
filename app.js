/*
 * Chorey starts with today and lets yesterday go. The application layer
 * coordinates the scheduler, storage, and interface without turning missed
 * chores into debt, warnings, or guilt.
 */
const ChoreyApp = (() => {
  const { getPerson, escapeHTML } = ChoreyUtils;
  const { profileRepository, taskRepository, occurrenceRepository, dailyRepository } = ChoreyRepositories;

  let activeDayData = null;
  let congratsTriggeredForToday = false;
  let currentView = "today";
  let refreshInProgress = false;
  let pollingTimer = null;
  const POLL_INTERVAL_MS = 60 * 1000;

  async function getActivePerson() {
    return getPerson(await profileRepository.getActivePersonId());
  }

  function clearConnectionBanner() {
    document.querySelector(".connection-banner")?.remove();
    document.body.classList.remove("shared-unavailable");
  }

  function showConnectionBanner(message = "SupaChorey could not reach the shared chore list.") {
    clearConnectionBanner();
    document.body.classList.add("shared-unavailable");
    const banner = document.createElement("div");
    banner.className = "connection-banner";
    banner.innerHTML = `<span>${escapeHTML(message)}</span><button type="button" class="connection-retry">Retry</button>`;
    document.querySelector(".container")?.prepend(banner);
    banner.querySelector(".connection-retry")?.addEventListener("click", () => initApp());
  }

  async function loadSharedTasks() {
    let tasks = await taskRepository.getAll();
    if (tasks.length) return { tasks, wasSeeded: false };

    await taskRepository.seedDefaults(defaultTasks);
    tasks = await taskRepository.getAll();
    if (!tasks.length) throw new Error("SupaChorey could not confirm the default task seed.");
    return { tasks, wasSeeded: true };
  }

  async function initApp() {
    if (refreshInProgress) return;
    refreshInProgress = true;
    try {
      const activePerson = await getActivePerson();
      const { tasks, wasSeeded } = await loadSharedTasks();
      activeDayData = ChoreyScheduler.buildDayData(tasks, activePerson, ChoreyClock.now());

      clearConnectionBanner();
      document.getElementById("date-subheading").textContent = activeDayData.displayDate;
      await dailyRepository.prepare(activeDayData.dateKey);
      congratsTriggeredForToday = await dailyRepository.getCongratulationsShown();

      ChoreyUI.updateHeader(activePerson, async () => {
        await ChoreyTaskCreator.open(await getActivePerson(), refreshCurrentView);
      }, { title: currentView === "all" ? "All Tasks" : undefined });

      if (!activePerson) {
        currentView = "today";
        await profileRepository.clearActivePerson();
        renderLoginScreen();
        return;
      }

      if (currentView === "all" && activePerson.isOwner) await renderAllTasks();
      else {
        currentView = "today";
        await renderView({ skipSharedState: wasSeeded });
      }
    } catch (error) {
      console.error("SupaChorey could not refresh.", error);
      showConnectionBanner("Shared chores are unavailable. Check the connection and try again.");
      const viewport = document.getElementById("app-viewport");
      if (!viewport.innerHTML.trim()) {
        viewport.innerHTML = `<div class="connection-empty"><strong>Shared chores unavailable</strong><span>Your profile and local settings are safe. Shared actions are paused until Supabase reconnects.</span></div>`;
      }
    } finally {
      refreshInProgress = false;
    }
  }

  async function refreshCurrentView() {
    await initApp();
  }

  function renderLoginScreen() {
    ChoreyUI.renderLoginScreen(async personId => {
      const person = getPerson(personId);
      const passcode = prompt(`Enter passcode for ${person.name}:`);
      if (passcode === person.passcode) {
        await profileRepository.setActivePersonId(person.id);
        await initApp();
      } else if (passcode !== null) {
        alert("Incorrect profile passcode.");
      }
    });
  }


  async function renderView({ skipSharedState = false } = {}) {
    const viewport = document.getElementById("app-viewport");
    const activePerson = await getActivePerson();
    if (!activePerson) return renderLoginScreen();
    document.getElementById("date-subheading").textContent = activeDayData.displayDate;

    if (!skipSharedState) {
      await occurrenceRepository.prune(activeDayData.occurrences.map(item => item.id));
    }

    if (!activeDayData.occurrences.length) {
      ChoreyUI.renderEmptyDay(activePerson);
      viewport.querySelector("#view-all-tasks")?.addEventListener("click", showAllTasks);
      return;
    }

    const states = skipSharedState ? {} : await occurrenceRepository.getAll();
    const sections = new Map([["unassigned", []], ...people.map(person => [person.id, []])]);

    activeDayData.occurrences.forEach(item => {
      const state = states[item.id] || {
        assignedToId: item.task.defaultAssigneeId || null,
        isDone: false,
        completedById: null,
        assignedByAdmin: false,
        assignedById: null,
        assignedByCompletion: false,
      };
      const configured = { ...item, ...state };
      const sectionId = getPerson(configured.assignedToId) ? configured.assignedToId : "unassigned";
      sections.get(sectionId).push(configured);
    });

    const dueToday = activeDayData.occurrences.filter(item =>
      item.occurrence.duration === "day" || item.occurrence.closesOn === activeDayData.dateKey
    );
    const allDueTodayComplete = dueToday.length > 0 && dueToday.every(item => states[item.id]?.isDone);
    if (allDueTodayComplete && !congratsTriggeredForToday) await triggerTemporaryCongrats();

    ChoreySwipe.resetOpenRow();
    viewport.innerHTML = ChoreyUI.renderBoard(activePerson, activeDayData, sections);

    viewport.querySelectorAll(".chore-item[data-id]").forEach(row => {
      row.querySelector(".assignment-button")?.addEventListener("click", async event => {
        event.stopPropagation();
        try {
          await handleAssignmentControl(row.dataset.id);
          clearConnectionBanner();
        } catch (error) {
          console.error("SupaChorey could not change the assignment.", error);
          showConnectionBanner("The assignment was not changed. Check the connection and retry.");
        }
      });

      const checkbox = row.querySelector(".chore-checkbox");
      checkbox?.addEventListener("click", event => event.stopPropagation());
      checkbox?.addEventListener("change", async event => {
        const requested = event.target.checked;
        try {
          if (!await toggleCompletion(row.dataset.id, requested)) event.target.checked = !requested;
          else clearConnectionBanner();
        } catch (error) {
          event.target.checked = !requested;
          console.error("SupaChorey could not change task completion.", error);
          showConnectionBanner("The completion was not changed. Check the connection and retry.");
        }
      });
    });

    viewport.querySelectorAll(".swipe-row.can-edit").forEach(wrapper => {
      ChoreySwipe.enableAction(wrapper, { onAction: () => openTaskEditor(wrapper.dataset.taskId) });
    });
    viewport.querySelector("#view-all-tasks")?.addEventListener("click", showAllTasks);
  }

  async function showAllTasks() {
    currentView = "all";
    await initApp();
  }

  async function renderAllTasks() {
    const active = await getActivePerson();
    if (!active?.isOwner) {
      currentView = "today";
      return renderView();
    }
    const viewport = document.getElementById("app-viewport");
    document.getElementById("date-subheading").textContent = "Daily, Monthly, and Yearly";
    ChoreySwipe.resetOpenRow();
    viewport.innerHTML = ChoreyUI.renderAllTasks(await taskRepository.getAll());
    viewport.querySelectorAll(".swipe-row.can-edit").forEach(wrapper => {
      ChoreySwipe.enableAction(wrapper, { onAction: () => openTaskEditor(wrapper.dataset.taskId) });
    });
    viewport.querySelector("#back-to-today")?.addEventListener("click", async () => {
      currentView = "today";
      await initApp();
    });
  }

  async function openTaskEditor(taskId) {
    const active = await getActivePerson();
    if (!active?.isOwner) return;
    const task = (await taskRepository.getAll()).find(item => item.id === taskId);
    if (!task) return refreshCurrentView();
    await ChoreyTaskCreator.open(active, refreshCurrentView, task);
  }

  async function handleAssignmentControl(id) {
    const active = await getActivePerson();
    const states = await occurrenceRepository.getAll();
    const task = activeDayData.occurrences.find(item => item.id === id)?.task;
    const current = states[id] || { assignedToId: task?.defaultAssigneeId || null, isDone: false, assignedByAdmin: false, assignedById: null, assignedByCompletion: false };
    if (current.isDone) return;

    if (active.isOwner) return openAssignmentModal(id, active);

    if (active.isAdmin) {
      const assignee = getPerson(current.assignedToId);
      const assigner = getPerson(current.assignedById);
      const ownerControlled = assignee?.isOwner || assigner?.isOwner || (current.assignedByAdmin && !current.assignedById && current.assignedToId !== active.id);
      const canManage = !ownerControlled && (current.assignedToId === null || current.assignedById === active.id || (current.assignedToId === active.id && !current.assignedByAdmin));
      if (!canManage) return;
      return openAssignmentModal(id, active);
    }

    if (current.assignedToId === null) {
      states[id] = { assignedToId: active.id, isDone: false, completedById: null, assignedByAdmin: false, assignedById: active.id, assignedByCompletion: false };
    } else if (current.assignedToId === active.id && !current.assignedByAdmin && (!current.assignedById || current.assignedById === active.id)) {
      delete states[id];
    } else {
      return;
    }

    if (states[id]) await occurrenceRepository.set(id, states[id]);
    else await occurrenceRepository.delete(id);
    await renderView();
  }

  function openAssignmentModal(id, active) {
    const assignable = people.filter(person => active.isOwner || (!person.isOwner && (!person.isAdmin || person.id === active.id)));
    const overlay = document.createElement("div");
    overlay.className = "assignment-overlay";
    overlay.innerHTML = `<div class="assignment-modal-card"><div class="assignment-modal-title">Assign Task</div><ul class="chore-list">${assignable.map(person => `<li class="chore-item profile-card" data-assign="${person.id}" style="--person-accent:${person.accent}"><span class="chore-title">${escapeHTML(person.name)}</span></li>`).join("")}<li class="chore-item unassigned-option" data-assign=""><span class="chore-title">Unassigned</span></li></ul><button class="modal-cancel">Cancel</button></div>`;
    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-assign]").forEach(row => row.addEventListener("click", async () => {
      try {
        const states = await occurrenceRepository.getAll();
        const current = states[id] || {};
        const target = row.dataset.assign || null;
        if (target) {
          states[id] = {
            ...current,
            assignedToId: target,
            isDone: false,
            completedById: null,
            assignedByAdmin: true,
            assignedById: active.id,
            assignedByCompletion: false,
          };
        } else {
          delete states[id];
        }
        if (states[id]) await occurrenceRepository.set(id, states[id]);
        else await occurrenceRepository.delete(id);
        overlay.remove();
        clearConnectionBanner();
        await renderView();
      } catch (error) {
        console.error("SupaChorey could not change the assignment.", error);
        showConnectionBanner("The assignment was not changed. Check the connection and retry.");
      }
    }));
    overlay.querySelector(".modal-cancel").addEventListener("click", () => overlay.remove());
  }

  async function toggleCompletion(id, checked) {
    const active = await getActivePerson();
    const states = await occurrenceRepository.getAll();
    const task = activeDayData.occurrences.find(item => item.id === id)?.task;
    const current = states[id] || {
      assignedToId: task?.defaultAssigneeId || null,
      isDone: false,
      completedById: null,
      assignedByAdmin: false,
      assignedById: null,
      assignedByCompletion: false,
    };

    if (active.isOwner && checked) {
      states[id] = {
        ...current,
        assignedToId: current.assignedToId || active.id,
        assignedById: current.assignedToId ? current.assignedById : active.id,
        assignedByCompletion: current.assignedToId === null,
        isDone: true,
        completedById: active.id,
        completedAt: new Date().toISOString(),
      };
    } else if (checked) {
      const assignee = getPerson(current.assignedToId);
      if (!(current.assignedToId === null || current.assignedToId === active.id || (active.isAdmin && assignee && !assignee.isAdmin))) return false;
      states[id] = {
        ...current,
        assignedToId: current.assignedToId || active.id,
        assignedById: current.assignedToId ? current.assignedById : active.id,
        assignedByCompletion: current.assignedToId === null,
        isDone: true,
        completedById: active.id,
        completedAt: new Date().toISOString(),
      };
    } else {
      const worker = getPerson(current.completedById);
      if (!(current.completedById === active.id || active.isOwner || (active.isAdmin && (!worker || !worker.isAdmin)))) return false;
      if (current.assignedByCompletion) delete states[id];
      else states[id] = { ...current, isDone: false, completedById: null, completedAt: null };
    }

    if (!checked) {
      congratsTriggeredForToday = false;
      await dailyRepository.setCongratulationsShown(false);
    }
    if (states[id]) await occurrenceRepository.set(id, states[id]);
    else await occurrenceRepository.delete(id);
    await renderView();
    return true;
  }

  async function triggerTemporaryCongrats() {
    congratsTriggeredForToday = true;
    await dailyRepository.setCongratulationsShown(true);
    ChoreyUI.showCongratulations();
  }

  const dateSubheading = document.getElementById("date-subheading");
  const LONG_PRESS_MS = 1000;
  let dateHoldTimer = null;
  let dateLongPressTriggered = false;

  function clearDateHold() {
    if (dateHoldTimer !== null) window.clearTimeout(dateHoldTimer);
    dateHoldTimer = null;
  }

  async function openDeveloperMenu() {
    const active = await getActivePerson();
    if (!active?.isOwner) return;
    document.querySelector(".developer-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "developer-overlay";
    const simulated = ChoreyClock.now().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    overlay.innerHTML = `
      <div class="developer-modal-card" role="dialog" aria-modal="true" aria-label="Developer menu">
        <div class="developer-modal-title">Developer</div>
        <div class="developer-version">Chorey v${escapeHTML(CHOREY_APP_VERSION)}</div>
        <div class="developer-date-status">Scheduler date: ${escapeHTML(simulated)}</div>
        <button class="developer-menu-button danger" data-dev-action="reset-shared">Reset Default Task List</button>
        <button class="developer-menu-button danger" data-dev-action="reset-local">Reset Local Data</button>
        <div class="developer-menu-label">Time Travel</div>
        <button class="developer-menu-button" data-dev-action="tomorrow">Tomorrow</button>
        <button class="developer-menu-button" data-dev-action="week">Next Week</button>
        <button class="developer-menu-button" data-dev-action="month">Next Month</button>
        <button class="developer-menu-button" data-dev-action="today" ${ChoreyClock.isOverridden() ? "" : "disabled"}>Return to Today</button>
        <button class="developer-menu-button cancel" data-dev-action="cancel">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", async event => {
      const action = event.target.closest("[data-dev-action]")?.dataset.devAction;
      if (!action) { if (event.target === overlay) overlay.remove(); return; }
      if (action === "cancel") { overlay.remove(); return; }
      if (action === "reset-local") {
        if (!confirm("Reset this device's local Chorey settings? Shared tasks and completions will not be changed.")) return;
        ChoreyStorage.resetAllData();
        location.reload();
        return;
      }
      if (action === "reset-shared") {
        const owner = await getActivePerson();
        if (!owner?.isOwner) { overlay.remove(); return; }
        const passcode = prompt("Enter the Owner passcode to reset the shared task list:");
        if (passcode === null) return;
        if (passcode !== owner.passcode) { alert("Incorrect Owner passcode."); return; }
        if (!confirm("Reset the shared task list to the current hardcoded defaults? This permanently deletes every shared task, assignment, and completion.")) return;
        try {
          await taskRepository.resetToDefaults(defaultTasks);
          overlay.remove();
          currentView = "today";
          await initApp();
        } catch (error) {
          console.error("SupaChorey could not reset the shared task list.", error);
          showConnectionBanner("The shared task reset did not finish. Retry after checking the connection.");
        }
        return;
      }
      if (action === "tomorrow") ChoreyClock.advanceDays(1);
      if (action === "week") ChoreyClock.advanceDays(7);
      if (action === "month") ChoreyClock.advanceMonth();
      if (action === "today") ChoreyClock.returnToToday();
      overlay.remove();
      currentView = "today";
      await initApp();
    });
  }

  dateSubheading.addEventListener("pointerdown", async event => {
    if (event.button !== undefined && event.button !== 0) return;
    const active = await getActivePerson();
    if (!active?.isOwner) return;
    dateLongPressTriggered = false;
    clearDateHold();
    dateHoldTimer = window.setTimeout(() => {
      dateLongPressTriggered = true;
      openDeveloperMenu();
      navigator.vibrate?.(30);
    }, LONG_PRESS_MS);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(type => dateSubheading.addEventListener(type, clearDateHold));
  dateSubheading.addEventListener("click", async event => {
    if (dateLongPressTriggered) {
      event.preventDefault();
      dateLongPressTriggered = false;
      return;
    }
    currentView = "today";
    await profileRepository.clearActivePerson();
    await initApp();
  });


  function canBackgroundRefresh() {
    return !document.hidden && !document.querySelector(".assignment-overlay, .developer-overlay");
  }

  async function refreshFromSharedState() {
    if (!canBackgroundRefresh()) return;
    await initApp();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshFromSharedState();
  });
  window.addEventListener("focus", refreshFromSharedState);

  pollingTimer = window.setInterval(refreshFromSharedState, POLL_INTERVAL_MS);

  return Object.freeze({ init: initApp });
})();

ChoreyApp.init();
