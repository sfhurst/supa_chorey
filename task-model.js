/* Shared task and occurrence normalization for schema v8. */
const ChoreyTaskModel = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const validPersonIds = () => new Set(people.map(person => person.id));
  const uniquePeople = values => {
    const valid = validPersonIds();
    return [...new Set((Array.isArray(values) ? values : []).map(String).filter(id => valid.has(id)))];
  };

  function normalizeVisibility(task) {
    if (["task-days-personal-take-a-shower", "task-days-personal-groom"].includes(task.id)) return "private";
    if (task.visibility === "private" || task.visibility?.type === "private") return "private";
    return "visible";
  }

  function normalizeTask(input) {
    const task = clone(input || {});
    const legacyDefault = task.defaultAssigneeId ? [task.defaultAssigneeId] : [];
    const builtInDefault = typeof defaultTasks !== "undefined"
      ? defaultTasks.find(defaultTask => defaultTask.id === task.id)
      : null;
    const shouldUpgradeBuiltInAssignment = Boolean(builtInDefault && task.builtInAssignmentVersion !== 1);
    const normalized = {
      ...task,
      createdById: people.some(person => person.id === task.createdById) ? task.createdById : "person-001",
      visibility: normalizeVisibility(task),
      defaultAssignedIds: uniquePeople(
        shouldUpgradeBuiltInAssignment
          ? builtInDefault.defaultAssignedIds
          : (task.defaultAssignedIds || legacyDefault)
      ),
      active: task.active !== false,
      ...(builtInDefault ? { builtInAssignmentVersion: 1 } : {}),
    };
    delete normalized.defaultAssigneeId;
    if (normalized.visibility === "private") normalized.defaultAssignedIds = [normalized.createdById];
    if (!normalized.schedule || typeof normalized.schedule !== "object") {
      normalized.schedule = { type: "indefinite", date: null, days: [], week: null, months: [] };
    }
    normalized.schedule = {
      type: normalized.schedule.type || "indefinite",
      date: normalized.schedule.date || null,
      days: Array.isArray(normalized.schedule.days) ? normalized.schedule.days : [],
      week: normalized.schedule.week ?? null,
      months: Array.isArray(normalized.schedule.months) ? normalized.schedule.months : [],
    };
    return normalized;
  }

  function normalizeOccurrence(input, task) {
    const state = clone(input || {});
    const legacyAssigned = state.assignedToId ? [state.assignedToId] : [];
    const defaults = task?.visibility === "private" ? [task.createdById] : task?.defaultAssignedIds || [];
    const suppliedAssignedIds = uniquePeople(state.assignedIds || legacyAssigned);
    const hasAssignmentOverride = state.assignmentOverride === true;
    const assignedIds = hasAssignmentOverride ? suppliedAssignedIds : (suppliedAssignedIds.length ? suppliedAssignedIds : uniquePeople(defaults));
    const normalized = {
      ...state,
      assignedIds,
      assignmentOverride: hasAssignmentOverride,
      assignedById: state.assignedById || null,
      assignmentType: state.assignmentType || (state.assignedByAdmin ? "temporary" : null),
      selfAssignedIds: uniquePeople(state.selfAssignedIds || (state.assignedByCompletion && state.completedById ? [state.completedById] : [])),
      isDone: Boolean(state.isDone),
      completedById: state.completedById || null,
      completedAt: state.completedAt || null,
    };
    delete normalized.assignedToId;
    delete normalized.assignedByAdmin;
    delete normalized.assignedByCompletion;
    if (task?.visibility === "private") { normalized.assignedIds = [task.createdById]; normalized.selfAssignedIds = []; }
    return normalized;
  }

  function canEditTask(person, task) {
    if (!person || !task) return false;
    return Boolean(person.isOwner || task.createdById === person.id);
  }

  function canCreateVisible(person) { return Boolean(person); }
  function canCreatePrivate(person) { return Boolean(person); }
  function canManageAssignments(person) { return Boolean(person?.isOwner || person?.isAdmin); }

  return Object.freeze({ normalizeTask, normalizeOccurrence, uniquePeople, canEditTask, canCreateVisible, canCreatePrivate, canManageAssignments });
})();
