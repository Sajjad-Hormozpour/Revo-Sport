import type { AppData } from "./types";

export function emptyData(): AppData {
  return {
    users: [],
    students: [],
    programs: [],
    logs: [],
    meals: [],
    progress: [],
    photos: [],
    goals: [],
    messages: [],
    notifs: [],
    appts: [],
    invoices: [],
    water: {},
    sleep: {},
    xp: {},
    streak: {},
    coachExercises: [],
    coachPlans: {},
    foods: [],
    nutritionLogs: [],
    checkins: [],
    workoutTemplates: [],
  };
}

/** @deprecated use emptyData — kept so old imports don't break */
export function makeSeed(): AppData {
  return emptyData();
}
