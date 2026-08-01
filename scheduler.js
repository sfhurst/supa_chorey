/* Chorey schedules only the current useful window. Yesterday creates no debt. */
const ChoreyScheduler = (() => {
  const { dateKey } = ChoreyUtils;
  function normalizeSchedule(input) {
    if (typeof ChoreyTaskModel !== "undefined" && ChoreyTaskModel.normalizeSchedule) return ChoreyTaskModel.normalizeSchedule(input);
    const source=input||{}, type=source.type||"anytime";
    if(type==="indefinite") return {type:"anytime",repeats:false,days:[],weeks:[],months:[],oneTimeKeys:[],dateRule:null};
    if(type==="once") return {type:"dates",repeats:false,days:[],weeks:[],months:[],oneTimeKeys:source.date?[source.date]:[],dateRule:source.date?{kind:"specific",year:+source.date.slice(0,4),month:+source.date.slice(5,7),day:+source.date.slice(8,10)}:null};
    return {type,repeats:typeof source.repeats==="boolean"?source.repeats:true,days:Array.isArray(source.days)?source.days:[],weeks:Array.isArray(source.weeks)?source.weeks:(source.week!==undefined&&source.week!==null?[source.week]:[]),months:Array.isArray(source.months)?source.months:[],oneTimeKeys:Array.isArray(source.oneTimeKeys)?source.oneTimeKeys:[],dateRule:source.dateRule||null};
  }
  function getWeekInfo(date) {
    const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const weekNumber = Math.floor((saturday.getDate() - 1) / 7) + 1;
    const nextSaturday = new Date(saturday); nextSaturday.setDate(saturday.getDate() + 7);
    return { monday, saturday, sunday, weekNumber, isLast: nextSaturday.getMonth() !== saturday.getMonth() };
  }
  function isVisibleTo(task, person) { return task.visibility !== "private" || task.createdById === person?.id; }
  const selectedWeek = (schedule, info) => schedule.weeks.includes(info.isLast ? "last" : info.weekNumber) || schedule.weeks.includes(info.weekNumber);
  function ordinalWeekday(date) {
    const ordinal = Math.floor((date.getDate() - 1) / 7) + 1;
    const next = new Date(date); next.setDate(date.getDate() + 7);
    return { ordinal, isLast: next.getMonth() !== date.getMonth() };
  }
  function oneTimeMatch(schedule, key) { return schedule.repeats !== false || schedule.oneTimeKeys.includes(key); }

  function getOccurrence(task, date) {
    if (!task.active) return null;
    const schedule = normalizeSchedule(task.schedule);
    const today = dateKey(date);
    if (schedule.type === "anytime") return { key: `${task.id}@indefinite`, recurrence: "anytime", duration: "indefinite", opensOn: task.createdAt?.slice(0,10) || today, closesOn: null };
    if (schedule.type === "days") {
      if (schedule.months.length && !schedule.months.includes(date.getMonth() + 1)) return null;
      if (!schedule.days.includes(date.getDay()) || !oneTimeMatch(schedule, today)) return null;
      return { key: `${task.id}@${today}`, recurrence: "days", duration: "day", opensOn: today, closesOn: today };
    }
    if (schedule.type === "weeks") {
      const info = getWeekInfo(date), anchorMonth = info.saturday.getMonth() + 1, anchor = dateKey(info.saturday);
      if (schedule.months.length && !schedule.months.includes(anchorMonth)) return null;
      if (!selectedWeek(schedule, info) || !oneTimeMatch(schedule, anchor)) return null;
      return { key: `${task.id}@${anchor}`, recurrence: "weeks", duration: "week", opensOn: dateKey(info.monday), closesOn: dateKey(info.sunday), anchorOn: anchor };
    }
    if (schedule.type === "months") {
      const month = date.getMonth() + 1, monthKey = `${date.getFullYear()}-${String(month).padStart(2,"0")}`;
      if (!schedule.months.includes(month) || !oneTimeMatch(schedule, monthKey)) return null;
      return { key: `${task.id}@${monthKey}`, recurrence: "months", duration: "month", opensOn: `${monthKey}-01`, closesOn: dateKey(new Date(date.getFullYear(), month, 0)) };
    }
    if (schedule.type === "dates") {
      const rule = schedule.dateRule || {};
      let matches = false;
      if (rule.kind === "specific") matches = date.getMonth() + 1 === Number(rule.month) && date.getDate() === Number(rule.day) && (schedule.repeats || !rule.year || date.getFullYear() === Number(rule.year));
      if (rule.kind === "pattern") {
        const info = ordinalWeekday(date), ordinal = rule.ordinal === "last" ? info.isLast : info.ordinal === Number(rule.ordinal);
        matches = date.getDay() === Number(rule.weekday) && ordinal && (!rule.months?.length || rule.months.includes(date.getMonth() + 1));
      }
      if (!matches || !oneTimeMatch(schedule, today)) return null;
      return { key: `${task.id}@${today}`, recurrence: "dates", duration: "day", opensOn: today, closesOn: today };
    }
    return null;
  }
  function buildDayData(tasks, activePerson, date = new Date()) {
    const occurrences = tasks.filter(task => isVisibleTo(task, activePerson)).map(task => ({ task, occurrence: getOccurrence(task, date) })).filter(item => item.occurrence).map((item,index)=>({ ...item, originalIndex:index, id:item.occurrence.key, displayTask:`${item.task.category}: ${item.task.name}` }));
    return { dateKey: dateKey(date), displayDate: date.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" }), occurrences };
  }
  return Object.freeze({ buildDayData, getOccurrence, getWeekInfo, isVisibleTo });
})();
