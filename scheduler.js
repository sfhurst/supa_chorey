/* Chorey schedules only the current useful window. Yesterday creates no debt. */
const ChoreyScheduler = (() => {
  const { dateKey } = ChoreyUtils;
  function getWeekInfo(date) {
    const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const weekNumber = Math.floor((saturday.getDate() - 1) / 7) + 1;
    const nextSaturday = new Date(saturday); nextSaturday.setDate(saturday.getDate() + 7);
    return { monday, saturday, sunday, weekNumber, isLast: nextSaturday.getMonth() !== saturday.getMonth() };
  }
  function isVisibleTo(task, person) { return task.visibility !== "private" || task.createdById === person?.id; }
  function getOccurrence(task, date) {
    if (!task.active) return null;
    const schedule = task.schedule;
    if (schedule.type === "indefinite") return { key: `${task.id}@indefinite`, recurrence: "indefinite", duration: "indefinite", opensOn: task.createdAt?.slice(0,10) || dateKey(date), closesOn: null };
    if (schedule.type === "once") {
      if (schedule.date !== dateKey(date)) return null;
      return { key: `${task.id}@${schedule.date}`, recurrence: "once", duration: "day", opensOn: schedule.date, closesOn: schedule.date };
    }
    if (schedule.type === "days") {
      const month = date.getMonth() + 1;
      if (schedule.months.length && !schedule.months.includes(month)) return null;
      if (!schedule.days.includes(date.getDay())) return null;
      const key = dateKey(date);
      return { key: `${task.id}@${key}`, recurrence: "days", duration: "day", opensOn: key, closesOn: key };
    }
    if (schedule.type === "weeks") {
      const info = getWeekInfo(date), anchorMonth = info.saturday.getMonth() + 1;
      if (schedule.months.length && !schedule.months.includes(anchorMonth)) return null;
      if (!(schedule.week === "last" ? info.isLast : schedule.week === info.weekNumber)) return null;
      return { key: `${task.id}@${dateKey(info.saturday)}`, recurrence: "weeks", duration: "week", opensOn: dateKey(info.monday), closesOn: dateKey(info.sunday), anchorOn: dateKey(info.saturday) };
    }
    if (schedule.type === "months") {
      const month = date.getMonth() + 1;
      if (!schedule.months.includes(month)) return null;
      const monthKey = `${date.getFullYear()}-${String(month).padStart(2,"0")}`;
      return { key: `${task.id}@${monthKey}`, recurrence: "months", duration: "month", opensOn: `${monthKey}-01`, closesOn: dateKey(new Date(date.getFullYear(), month, 0)) };
    }
    return null;
  }
  function buildDayData(tasks, activePerson, date = new Date()) {
    const occurrences = tasks.filter(task => isVisibleTo(task, activePerson)).map(task => ({ task, occurrence: getOccurrence(task, date) })).filter(item => item.occurrence).map((item,index)=>({ ...item, originalIndex:index, id:item.occurrence.key, displayTask:`${item.task.category}: ${item.task.name}` }));
    return { dateKey: dateKey(date), displayDate: date.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" }), occurrences };
  }
  return Object.freeze({ buildDayData, getOccurrence, isVisibleTo });
})();
