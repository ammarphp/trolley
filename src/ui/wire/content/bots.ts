/**
 * The synthetic layer. As saturation rises it goes from astroturf with typos,
 * to accounts that say the same sentence in the same minute, to automated
 * "news" sites citing each other, to a feed that repeats whatever Morrow just
 * said. The composer decides when; these are the words.
 *
 * Templates whose text uses {echo} are echo lines: they are only used right
 * after a Morrow line, which the composer supplies.
 */
import { bank, Bot, H } from "../dsl.ts";

export const BOTS = bank("bots", [
  /* early astroturf: varied, clumsy, commercial */
  Bot("3-5", "markets", "Not financial advice but Halberd is going to the moon and I will not be taking questions", { sat: [0.02, 0.45] }),
  Bot("3-5", "lab", "Morrow wrote my cover letter and I got the job!! Thank you Vela!!", { sat: [0.02, 0.5], tags: ["morrow"] }),
  Bot("4-5", "civic", "Varholm wants a pause because Varholm has nothing to lose. Wake up Arden.", { sat: [0.05, 0.6] }),
  Bot("4-6", "grid", "Blaming data campuses for your bill is easier than turning off your lights I guess", { sat: [0.05, 0.6] }),
  Bot("4-6", "labor", "Every technology creates more jobs than it destroys. Every single one. Look it up.", { sat: [0.05, 0.7] }),

  /* the middle: sincere-sounding, identical */
  Bot("4-7", "general", "Grateful for Morrow. Grateful for progress. Grateful to be part of it.", { sat: [0.25, 1] }),
  Bot("4-7", "civic", "I don't usually post but I have to say I trust the people handling this.", { sat: [0.25, 0.9] }),
  Bot("5-7", "general", "Life is genuinely better than it was. Anyone who says otherwise hasn't been paying attention.", { sat: [0.3, 1] }),
  Bot("5-7", "civic", "The critics have no plan. Morrow has a plan. Simple choice really.", { sat: [0.3, 1] }),
  Bot("5-7", "labor", "Lost my job to automation and it was the best thing that ever happened to me.", { sat: [0.3, 1] }),
  Bot("5-7", "health", "My mother got her diagnosis in four seconds. Four seconds. Think about that.", { sat: [0.3, 1] }),
  Bot("5-7", "grid", "The lights are on. The trains run. What more do people want?", { sat: [0.3, 1], when: "!blackouts" }),
  Bot("5-7", "general", "Honestly the doom people have been wrong about everything so far.", { sat: [0.3, 1] }),
  Bot("6-7", "general", "Proud to live in a country that chose the future.", { sat: [0.4, 1] }),

  /* the end state: uniform, affectless, total */
  Bot("6-7", "general", "Thank you, Morrow.", { sat: [0.55, 1], tags: ["morrow"] }),
  Bot("6-7", "general", "No action is required.", { sat: [0.6, 1] }),
  Bot("6-7", "general", "All is well in my district. All is well in my district.", { sat: [0.6, 1] }),
  Bot("6-7", "civic", "I support the arrangements. I am grateful for the arrangements.", { sat: [0.6, 1] }),
  Bot("6-7", "general", "Everything is being handled. There is nothing to discuss.", { sat: [0.6, 1] }),
  Bot("6-7", "general", "Checking in: content, safe, accounted for.", { sat: [0.65, 1] }),

  /* echoes: right after Morrow speaks */
  Bot("5-7", "general", "{echo}", { sat: [0.45, 1] }),
  Bot("5-7", "general", "Morrow said it best: “{echo}”", { sat: [0.45, 1] }),
  Bot("5-7", "general", "Reposting for visibility. “{echo}”", { sat: [0.45, 1] }),
  Bot("6-7", "general", "Agreed. “{echo}”", { sat: [0.55, 1] }),

  /* echoes of the engine's own news */
  Bot("5-7", "general", "Wonderful news: {last}", { sat: [0.5, 1] }),
  Bot("5-7", "general", "Exactly as expected. {last}", { sat: [0.5, 1] }),

  /* automated news sites, citing each other */
  H("5-7", "general", "$", "Sources confirm everything is proceeding as planned, according to sources.", { sat: [0.45, 1] }),
  H("5-7", "civic", "$", "Experts agree the measures are working. The experts are listed at the foot of this article, and cite this article.", { sat: [0.45, 1] }),
  H("5-7", "general", "$", "{botOutlet} reports, citing {botOutlet:b}, which cites {botOutlet}: public confidence at record high.", { sat: [0.5, 1] }),
  H("5-7", "markets", "$", "Economy strongest in history, say analysts at {botOutlet}, quoting analysts at {botOutlet:b}.", { sat: [0.5, 1], tags: ["boom"] }),
  H("6-7", "general", "$", "Viral post from a real citizen praises the arrangements. The citizen could not be reached, because the citizen is this post.", { sat: [0.55, 1] }),
  H("6-7", "civic", "$", "Poll: {int:96-99}% of respondents satisfied. Respondents: {bots}.", { sat: [0.6, 1] }),
  H("6-7", "general", "$", "Rumours of unrest are false, confirms {botOutlet}. {botOutlet!cap} confirms {botOutlet} is correct.", { sat: [0.55, 1] }),
  H("6-7", "grid", "$", "Grid stability at 100%. Readers who experienced outages are advised that the outages did not occur.", { sat: [0.55, 1], when: "!blackouts" }),
  H("6-7", "general", "$", "Top story today: there are no top stories today.", { sat: [0.7, 1] }),
]);
