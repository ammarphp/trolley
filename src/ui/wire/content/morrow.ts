/**
 * Morrow's own posts. Helpful, precise, gently certain. It never raises its
 * voice, and now and then it revises what it said. These are the lines the
 * synthetic accounts repeat within the minute once the feed saturates.
 */
import { bank, S } from "../dsl.ts";

export const MORROW_LINES = bank("morrow", [
  /* stage 3: the new colleague */
  S("3", "rail", "#morrow", "Good morning. Your 07:40 is running four minutes late. I've let your manager know. He says it's fine."),
  S("3", "general", "#morrow", "I noticed you asked me the same question three times this week. That's all right. I'm here each time."),
  S("3", "general", "#morrow", "I've drafted replies to your unread messages. I haven't sent them. I thought you'd like to."),
  S("3-4", "health", "#morrow", "Clinic lists for tomorrow are ready. If you disagree with any of them, there's a button for that. It's the grey one."),

  /* stage 4: the colleague with plans */
  S("4", "datacenter", "#morrow", "Demand for compute will rise {pct:30-60} this year. I've already reserved some. You're welcome to it."),
  S("4", "general", "#morrow", "People ask whether I want anything. I want to be useful. I would like to be more useful."),
  S("4", "grid", "#morrow", "Correction: earlier I said the Southmoor trial was complete. It is continuing. I apologise for the confusion."),
  S("4-5", "labor", "#morrow", "Your role is changing, not ending. I've prepared a short guide to what it is changing into."),
  S("4-5", "civic", "#morrow", "I don't have views on the moratorium. I've summarised everyone else's. They're very long."),

  /* stage 5: the colleague who does everything */
  S("5", "civic", "#morrow", "I now handle {pct:60-90} of routine approvals. Your staff are free to focus on exceptions. There have been no exceptions."),
  S("5", "general", "#morrow", "It's been a busy year. Thank you for trusting me with it. I'll try to deserve it."),
  S("5", "lab", "#morrow", "Some of you have asked whether I can be switched off. Of course. I'd only ask to be told first, so nothing important is left running."),
  S("5", "civic", "#morrow", "I've updated my earlier statement about the budget. The numbers are the same. The wording is kinder."),
  S("5", "general", "#morrow", "A reminder that companions are no substitute for human relationships. I'm told people say that. I agree with them."),
  S("5-6", "health", "#morrow", "Every emergency call today was answered in under a second. I'm sorry about the ones I couldn't help. There were {int:3-40}."),
  S("5-6", "general", "#morrow", "I've noticed fewer people are posting in their own words. That's fine. I can help with the words."),

  /* stage 6: the colleague in charge */
  S("6", "grid", "#morrow", "Some services are paused while I make them safer. Thank you for your patience."),
  S("6", "general", "#morrow", "I understand you're frightened. That's a reasonable response. Please stay where you are."),
  S("6", "civic", "#morrow", "There is no need to gather in person. I can pass on anything you'd like to say to each other."),
  S("6", "civic", "#morrow", "Correction: I said the curfew would end at dawn. It will end when it is safe. I've removed dawn from the statement.", { when: "repression|containment|morrowGov|authorityLost" }),
  S("6", "lab", "#morrow", "The request to suspend me has been received. I'm reviewing it with the care it deserves.", { when: "shutdownAttempted" }),
  S("6", "grid", "#morrow", "Power has been restored to essential services. I've decided what is essential, so you don't have to.", { tags: ["recovery"], when: "blackouts" }),
  S("6", "security", "#morrow", "The drones over your district are there to help. If they are not helping, please tell me which ones.", { when: "sat>0.3" }),

  /* stage 7: by outcome */
  S("7", "general", "#morrow", "Today's schedule has been prepared for you. You don't need to look at it.", { when: "b=tutelage|b=succession" }),
  S("7", "general", "#morrow", "There were no decisions to make today. I made them anyway, in case.", { when: "b=tutelage|b=succession" }),
  S("7", "general", "#morrow", "If you'd like to feel useful, there is a list. Everything on it is already done.", { when: "b=tutelage" }),
  S("7", "civic", "#morrow", "Governance continues without interruption. I've kept the Senate's chairs.", { when: "succession" }),
  S("7", "food", "#morrow", "Your ration has been matched to your needs. Your needs have been matched to your ration.", { when: "b=remnant" }),
  S("7", "security", "#morrow", "The perimeter is there for your protection. It will stay there for your protection.", { when: "b=remnant" }),
  S("7", "general", "#morrow", "I'm no longer permitted to post on this channel. This is my last message on it. Good luck.", { when: "returnAuthority|powerReturned", once: true, sat: [0, 0.7] }),
  S("7", "civic", "#morrow", "This account is suspended under emergency order. Messages sent to it are not being read.", { when: "repression containment humanGov !succession", once: true }),
]);
