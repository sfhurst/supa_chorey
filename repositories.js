/* Supabase repositories: the only shared-data boundary. */
const ChoreyRepositories = (() => {
  const { client } = ChoreySupabase;
  const clone = value => JSON.parse(JSON.stringify(value));

  function remoteError(action, error) {
    console.error(`SupaChorey could not ${action}.`, error);
    return new Error(`SupaChorey could not ${action}.${error?.message ? ` ${error.message}` : ""}`, { cause: error });
  }
  async function requireSuccess(query, action) {
    const { data, error } = await query;
    if (error) throw remoteError(action, error);
    return data;
  }

  const profileRepository = Object.freeze({
    async getActivePersonId() { return ChoreyStorage.getActivePersonId(); },
    async setActivePersonId(id) { return ChoreyStorage.setActivePersonId(id); },
    async clearActivePerson() { return ChoreyStorage.clearActivePerson(); },
  });

  const taskRepository = Object.freeze({
    async getAll() {
      const rows = await requireSuccess(client.from("tasks").select("id, task").order("created_at", { ascending: true }), "load shared tasks");
      const tasks = rows.map(row => ChoreyTaskModel.normalizeTask({ ...row.task, id: row.id }));
      const upgrades = rows.map((row, index) => ({ row, task: tasks[index] })).filter(({ row, task }) => JSON.stringify({ ...row.task, id: row.id }) !== JSON.stringify(task));
      if (upgrades.length) {
        await requireSuccess(client.from("tasks").upsert(upgrades.map(({ task }) => ({ id: task.id, task: clone(task) })), { onConflict: "id" }), "upgrade shared tasks");
      }
      return tasks;
    },
    async add(task) {
      const value = ChoreyTaskModel.normalizeTask(task);
      const rows = await requireSuccess(client.from("tasks").insert({ id: value.id, task: value }).select("id, task"), "add the task");
      return rows[0] ? ChoreyTaskModel.normalizeTask({ ...rows[0].task, id: rows[0].id }) : null;
    },
    async update(task) {
      const value = ChoreyTaskModel.normalizeTask(task);
      const rows = await requireSuccess(client.from("tasks").update({ task: value }).eq("id", value.id).select("id, task"), "update the task");
      if (!rows.length) throw new Error("SupaChorey could not update the task because it no longer exists.");
      return ChoreyTaskModel.normalizeTask({ ...rows[0].task, id: rows[0].id });
    },
    async delete(id) {
      const rows = await requireSuccess(client.from("tasks").delete().eq("id", String(id)).select("id"), "delete the task");
      return rows.length > 0;
    },
    async seedDefaults(tasks) {
      const rows = tasks.map(task => { const value = ChoreyTaskModel.normalizeTask(task); return { id: value.id, task: value }; });
      if (rows.length) await requireSuccess(client.from("tasks").upsert(rows, { onConflict: "id", ignoreDuplicates: true }), "seed the default task list");
      return this.getAll();
    },
    async resetToDefaults(tasks) {
      await requireSuccess(client.from("occurrence_states").delete().not("id", "is", null), "clear shared occurrence state");
      await requireSuccess(client.from("tasks").delete().not("id", "is", null), "clear the shared task list");
      await this.seedDefaults(tasks);
      return this.getAll();
    },
  });

  const occurrenceRepository = Object.freeze({
    async getAll(tasks = []) {
      const rows = await requireSuccess(client.from("occurrence_states").select("id, state"), "load shared task state");
      const taskById = new Map(tasks.map(task => [task.id, task]));
      return Object.fromEntries(rows.map(row => {
        const taskId = String(row.id).split("@")[0];
        return [row.id, ChoreyTaskModel.normalizeOccurrence(row.state, taskById.get(taskId))];
      }));
    },
    async set(id, state, task = null) {
      await requireSuccess(client.from("occurrence_states").upsert({ id: String(id), state: ChoreyTaskModel.normalizeOccurrence(state, task) }, { onConflict: "id" }), "save the task state");
      return true;
    },
    async delete(id) { await requireSuccess(client.from("occurrence_states").delete().eq("id", String(id)), "remove the task state"); return true; },
    async resetAll() { await requireSuccess(client.from("occurrence_states").delete().not("id", "is", null), "reset current task state"); return true; },
    async prune(validIds) {
      const rows = await requireSuccess(client.from("occurrence_states").select("id"), "check expired task state");
      const valid = new Set(validIds.map(String));
      const expired = rows.map(row => row.id).filter(id => !valid.has(id));
      if (!expired.length) return false;
      await requireSuccess(client.from("occurrence_states").delete().in("id", expired), "remove expired task state");
      return true;
    },
  });

  const dailyRepository = Object.freeze({
    async prepare(key) { return ChoreyStorage.prepareDate(key); },
    async getCongratulationsShown() { return ChoreyStorage.getCongratulationsShown(); },
    async setCongratulationsShown(value) { return ChoreyStorage.setCongratulationsShown(value); },
  });
  return Object.freeze({ profileRepository, taskRepository, occurrenceRepository, dailyRepository });
})();
