import type { D1Database } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { shiftDay, studyDay } from "../learning/study-day";
import type { Learner, Progress } from "../shared/learning";
import { getUser } from "./store";
import type { AppEnvironment } from "./types";

async function getProgress(db: D1Database, user: Learner): Promise<Progress> {
  const now = new Date();
  const userId = user.id;
  const today = studyDay(now, user.timezone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = shiftDay(today, -((weekday + 6) % 7));
  const activity = await db.prepare(`WITH activity AS (
      SELECT ev.study_day AS day, 1 AS reviews, 0 AS readings, 0 AS quizzes, 0 AS responses
        FROM review_events ev WHERE ev.user_id = ? AND ev.study_day BETWEEN ? AND ? AND ev.reverses_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM review_events undo WHERE undo.reverses_id = ev.id)
      UNION ALL SELECT completed_day AS day, 0 AS reviews, 1 AS readings, 0 AS quizzes, 0 AS responses
        FROM readings WHERE user_id = ? AND completed_day BETWEEN ? AND ?
      UNION ALL SELECT quiz_day AS day, 0 AS reviews, 0 AS readings, 1 AS quizzes, 0 AS responses
        FROM readings WHERE user_id = ? AND quiz_day BETWEEN ? AND ?
      UNION ALL SELECT response_day AS day, 0 AS reviews, 0 AS readings, 0 AS quizzes, 1 AS responses
        FROM readings WHERE user_id = ? AND response_day BETWEEN ? AND ?)
      SELECT day, SUM(reviews) AS reviews, SUM(readings) AS readings, SUM(quizzes) AS quizzes, SUM(responses) AS responses FROM activity GROUP BY day`)
      .bind(userId, weekStart, today, userId, weekStart, today, userId, weekStart, today, userId, weekStart, today)
      .all<Progress["days"][number]>();
  const days = new Map(activity.results.map((day) => [day.day, day]));
  return {
    id: user.id, name: user.name,
    days: Array.from({ length: 7 }, (_, index) => {
      const day = shiftDay(weekStart, index);
      return days.get(day) ?? { day, reviews: 0, readings: 0, quizzes: 0, responses: 0 };
    }),
  };
}
export const progressRoutes = new Hono<AppEnvironment>();
progressRoutes.get("/progress", async (context) => {
  const db = context.env.DB;
  const learner = await getUser(db, context.get("learnerId"));
  return context.json({ learners: [await getProgress(db, learner)] });
});
