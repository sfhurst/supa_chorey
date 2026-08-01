/* Shared task and occurrence normalization for schema v8. */
const ChoreyTaskModel = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const validPersonIds = () => new Set(people.map(person => person.id));
  const uniquePeople = values => {
    const valid = validPersonIds();
    return [...new Set((Array.isArray(values) ? values : []).map(String).filter(id => valid.has(id)))];
  };
  const uniqueNumbers = values => [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite))];
  const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];

  function normalizeVisibility(task) {
    if (["task-days-personal-take-a-shower", "task-days-personal-groom"].includes(task.id)) return "private";
    if (task.visibility === "private" || task.visibility?.type === "private") return "private";
    return "visible";
  }

  function normalizeSchedule(input) {
    const source = input && typeof input === "object" ? clone(input) : {};
    let type = source.type || "anytime";
    let repeats = typeof source.repeats === "boolean" ? source.repeats : true;
    const normalized = {
      type,
      repeats,
      days: uniqueNumbers(source.days).filter(day => day >= 0 && day <= 6),
      weeks: uniqueStrings(source.weeks || (source.week !== undefined && source.week !== null ? [source.week] : [])).map(value => value === "last" ? "last" : Number(value)).filter(value => value === "last" || (Number.isInteger(value) && value >= 1 && value <= 5)),
      months: uniqueNumbers(source.months).filter(month => month >= 1 && month <= 12),
      oneTimeKeys: uniqueStrings(source.oneTimeKeys),
      dateRule: source.dateRule && typeof source.dateRule === "object" ? clone(source.dateRule) : null,
    };

    // Seamless migration from the v0.8.6 schedule vocabulary.
    if (type === "indefinite") {
      normalized.type = "anytime";
      normalized.repeats = false;
    } else if (type === "once") {
      normalized.type = "dates";
      normalized.repeats = false;
      normalized.oneTimeKeys = source.date ? [source.date] : normalized.oneTimeKeys;
      normalized.dateRule = source.date ? { kind: "specific", month: Number(source.date.slice(5,7)), day: Number(source.date.slice(8,10)), year: Number(source.date.slice(0,4)) } : null;
    } else if (["days", "weeks", "months"].includes(type)) {
      normalized.repeats = typeof source.repeats === "boolean" ? source.repeats : true;
    } else if (!['dates','anytime'].includes(type)) {
      normalized.type = "anytime";
      normalized.repeats = false;
    }

    if (normalized.type === "anytime") normalized.repeats = false;
    if (normalized.type === "dates" && !normalized.dateRule && source.date) {
      normalized.dateRule = { kind: "specific", month: Number(source.date.slice(5,7)), day: Number(source.date.slice(8,10)), year: Number(source.date.slice(0,4)) };
    }
    return normalized;
  }

  function normalizeTask(input) {
    const task = clone(input || {});
    const legacyDefault = task.defaultAssigneeId ? [task.defaultAssigneeId] : [];
    const builtInDefault = typeof defaultTasks !== "undefined" ? defaultTasks.find(defaultTask => defaultTask.id === task.id) : null;
    const shouldUpgradeBuiltInAssignment = Boolean(builtInDefault && task.builtInAssignmentVersion !== 1);
    const normalized = {
      ...task,
      createdById: people.some(person => person.id === task.createdById) ? task.createdById : "person-001",
      visibility: normalizeVisibility(task),
      defaultAssignedIds: uniquePeople(shouldUpgradeBuiltInAssignment ? builtInDefault.defaultAssignedIds : (task.defaultAssignedIds || legacyDefault)),
      active: task.active !== false,
      schedule: normalizeSchedule(task.schedule),
      ...(builtInDefault ? { builtInAssignmentVersion: 1 } : {}),
    };
    delete normalized.defaultAssigneeId;
    if (normalized.visibility === "private") normalized.defaultAssignedIds = [normalized.createdById];
    return normalized;
  }

  function normalizeOccurrence(input, task) {
    const state = clone(input || {});
    const legacyAssigned = state.assignedToId ? [state.assignedToId] : [];
    const defaults = task?.visibility === "private" ? [task.createdById] : task?.defaultAssignedIds || [];
    const suppliedAssignedIds = uniquePeople(state.assignedIds || legacyAssigned);
    const hasAssignmentOverride = state.assignmentOverride === true;
    const assignedIds = hasAssignmentOverride ? suppliedAssignedIds : (suppliedAssignedIds.length ? suppliedAssignedIds : uniquePeople(defaults));
    const normalized = { ...state, assignedIds, assignmentOverride: hasAssignmentOverride, assignedById: state.assignedById || null, assignmentType: state.assignmentType || (state.assignedByAdmin ? "temporary" : null), selfAssignedIds: uniquePeople(state.selfAssignedIds || (state.assignedByCompletion && state.completedById ? [state.completedById] : [])), isDone: Boolean(state.isDone), completedById: state.completedById || null, completedAt: state.completedAt || null };
    delete normalized.assignedToId; delete normalized.assignedByAdmin; delete normalized.assignedByCompletion;
    if (task?.visibility === "private") { normalized.assignedIds = [task.createdById]; normalized.selfAssignedIds = []; }
    return normalized;
  }

  function canEditTask(person, task) { return Boolean(person && task && (person.isOwner || task.createdById === person.id)); }
  function canCreateVisible(person) { return Boolean(person); }
  function canCreatePrivate(person) { return Boolean(person); }
  function canManageAssignments(person) { return Boolean(person?.isOwner || person?.isAdmin); }

  return Object.freeze({ normalizeTask, normalizeSchedule, normalizeOccurrence, uniquePeople, canEditTask, canCreateVisible, canCreatePrivate, canManageAssignments });
})();
