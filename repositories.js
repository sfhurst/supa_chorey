/*
 * Repositories are Chorey's storage boundary. Application rules call these
 * small methods without needing to know whether data is local or shared.
 */
const ChoreyRepositories = (() => {
  const { client } = ChoreySupabase;
  const clone = value => JSON.parse(JSON.stringify(value));

  function remoteError(action, error) {
    console.error(`SupaChorey could not ${action}.`, error);
    const detail = error?.message ? ` ${error.message}` : "";
    return new Error(`SupaChorey could not ${action}.${detail}`, { cause: error });
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
      const rows = await requireSuccess(
        client.from("tasks").select("id, task").order("created_at", { ascending: true }),
        "load shared tasks"
      );
      return rows.map(row => clone({ ...row.task, id: row.id }));
    },

    async add(task) {
      const value = clone(task);
      const rows = await requireSuccess(
        client.from("tasks").insert({ id: value.id, task: value }).select("id, task"),
        "add the task"
      );
      return rows[0] ? clone({ ...rows[0].task, id: rows[0].id }) : null;
    },

    async update(task) {
      const value = clone(task);
      const rows = await requireSuccess(
        client.from("tasks").update({ task: value }).eq("id", value.id).select("id, task"),
        "update the task"
      );
      if (!rows.length) throw new Error("SupaChorey could not update the task because it no longer exists.");
      return clone({ ...rows[0].task, id: rows[0].id });
    },

    async delete(id) {
      const taskId = String(id || "");
      const rows = await requireSuccess(
        client.from("tasks").delete().eq("id", taskId).select("id"),
        "delete the task"
      );
      // Any now-orphaned occurrence rows are removed by the normal prune after
      // the refreshed task list is rendered. The task deletion itself remains
      // one database operation and cannot partially erase current state first.
      return rows.length > 0;
    },

    async seedDefaults(tasks) {
      const rows = tasks.map(task => ({ id: task.id, task: clone(task) }));
      if (!rows.length) return [];
      await requireSuccess(
        client.from("tasks").upsert(rows, { onConflict: "id", ignoreDuplicates: true }),
        "seed the default task list"
      );
      return this.getAll();
    },

    async resetToDefaults(tasks) {
      await requireSuccess(client.from("occurrence_states").delete().not("id", "is", null), "clear shared occurrence state");
      await requireSuccess(client.from("tasks").delete().not("id", "is", null), "clear the shared task list");
      await this.seedDefaults(tasks);
      const confirmed = await this.getAll();
      if (!confirmed.length) throw new Error("SupaChorey reset the task list but could not confirm the default tasks.");
      return confirmed;
    },
  });

  const occurrenceRepository = Object.freeze({
    async getAll() {
      const rows = await requireSuccess(
        client.from("occurrence_states").select("id, state"),
        "load shared task state"
      );
      return Object.fromEntries(rows.map(row => [row.id, clone(row.state)]));
    },

    async set(id, state) {
      const occurrenceId = String(id);
      await requireSuccess(
        client.from("occurrence_states").upsert(
          { id: occurrenceId, state: clone(state) },
          { onConflict: "id" }
        ),
        "save the task state"
      );
      return true;
    },

    async delete(id) {
      await requireSuccess(
        client.from("occurrence_states").delete().eq("id", String(id)),
        "remove the task state"
      );
      return true;
    },

    async prune(validIds) {
      const rows = await requireSuccess(
        client.from("occurrence_states").select("id"),
        "check expired task state"
      );
      const valid = new Set(validIds.map(String));
      const expired = rows.map(row => row.id).filter(id => !valid.has(id));
      if (!expired.length) return false;
      await requireSuccess(
        client.from("occurrence_states").delete().in("id", expired),
        "remove expired task state"
      );
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
