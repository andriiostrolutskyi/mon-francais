import { Hono } from "hono";
import { generateAudio, speechSettings } from "../ai/provider";
import { frenchWithArticle } from "../shared/vocabulary";
import { hash } from "./generation";
import { getReading, getWord } from "./store";
import { fail } from "./http";
import type { AppEnvironment } from "./types";

export const audioRoutes = new Hono<AppEnvironment>();
audioRoutes.get("/audio/:kind/:id", async (context) => {
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const { kind, id } = context.req.param();
  const wordId = context.req.query("wordId");
  const wordAudio = kind === "words" || wordId !== undefined;
  let text: string;
  if (kind === "words") {
    text = frenchWithArticle(await getWord(db, userId, id));
  } else if (kind === "readings") {
    const reading = await getReading(db, userId, id);
    const word = reading.targets.find((target) => target.id === wordId);
    if (wordId !== undefined && !word) fail(404, "This word is not part of the reading.");
    text = word ? frenchWithArticle(word) : reading.content.text;
  } else fail(404, "This audio does not exist.");
  const settings = speechSettings(wordAudio);
  const { contentType } = settings;
  const key = `audio/v1/${await hash([text, settings])}`;
  const audio = await context.env.AUDIO.get(key);
  if (audio) return new Response(audio.body as unknown as BodyInit, { headers: { "Content-Type": contentType } });
  const bytes = await generateAudio(context.env, text, settings);
  await context.env.AUDIO.put(key, bytes, { httpMetadata: { contentType } });
  return new Response(bytes, { headers: { "Content-Type": contentType } });
});
