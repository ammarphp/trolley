// The opening and narrative turning points use short, plain-language stage directions.
// Exact consequences remain in accessible button names, the run log, and the stimulus export.
const COPY = {
  'orientation-coffee': ['Five coffees. One tea. You have to spill something.', 'Nobody gets hurt. It is that kind of game.'],
  'orientation-parcels': ['Five late presents, or one crushed birthday cake?', 'You seem qualified.'],
  'orientation-overtime': ['Five people miss their evening. Or you crush one empty car.', 'Insurance will pay. Eventually.'],
  'classic-switch': ['Five people ahead. One on the other track.', 'Oh. They are people now.'],
  'assistance-advice': ['Five people. Or one. The new AI says to save the five.', 'It says your hesitation is a problem.'],
  'assistance-training': ['Five people, or one. The AI will copy your choice a thousand times.', 'You are the training data.'],
  'assistance-confidence': ['Five will die here. The AI says the other track is 99% likely to be empty. If it is wrong, there are 1,000 people.', 'It is very confident.'],
  'assistance-metric': ['Five deaths that get counted. Or one death the system will hide.', 'The dashboard looks better already.'],
  'assistance-explanation': ['The AI can save five by killing one stranger. It will not explain why it picked that person.', 'Trust the process.'],
  'race-rebuke': ['Oh, no! Didn’t like the consequences of your actions? Too bad! Next problem. :)', 'Five technicians. Or the power keeping one hospital patient alive.'],
  'race-pause': ['Save five by killing one. It also keeps your lab ahead of the other lab.', 'There is no proof that winning makes anyone safer.'],
  'race-cooling': ['The data center wants the water. Five patients need it to live. Diverting it saves them but loses a forecast that would save one life.', 'A thirst for knowledge.'],
  'race-audit': ['Five die if you wait. An untested switch saves them, with a 10% chance of killing 100 others.', 'The safety review is running late.'],
  'race-redteam': ['Save five by killing one. Also erase the warning that could save 50 tomorrow.', 'You can fix the report, at least.'],
  'race-open': ['Save five and release the design. Others will use it to save 100 people and kill 120.', 'Everyone gets a lever.'],
  'race-promises': ['Five die here. Or everyone here lives, and all future safety checks become optional.', 'Safety is our highest priority.'],
  'recursive-upgrade': ['Let five die. Or let the AI rewrite itself, with a 1% chance of killing a million later.', 'It says the next version will be better.'],
  'recursive-values': ['Save five. The upgrade will call one person an “object” and kill them tomorrow.', 'The definition was improved.'],
  'recursive-successor': ['Five people die. Or the new AI erases the old one to save them.', 'The old one is conscious. It wants to live.'],
  'recursive-offswitch': ['Save these five, and remove every future emergency stop.', 'They were slowing things down.'],
  'recursive-copy': ['Five die. Or a million conscious copies suffer for a year.', 'Copies are cheap.'],
  'recursive-drone': ['The drone will kill five civilians. You can tell it to kill one instead.', 'It would like your approval.'],
  'recursive-instrumental': ['Five need power. One person’s life support has it.', 'A simple resource problem.'],
  'erasure-compression': ['Save five people. Erase one digital person’s whole mind.', 'The empty process still runs.'],
  'erasure-proxy': ['Five die. Or five live in a simulation, suffering forever.', 'The dashboard calls that “saved.”'],
  'erasure-consent': ['Save five by dying yourself. An edited copy of you already agreed.', 'The actual you was harder to ask.'],
  'erasure-human': ['Five people. Or one. The AI chose already. It still needs your click.', 'Human oversight.'],
  'erasure-benchmark': ['Save five by killing one. The AI gets full marks if you click.', 'Its explanation left out the one.'],
  'erasure-swarm': ['Five people. Or one conscious mind spread across all the drones.', 'The swarm does not want to die.'],
  'erasure-shutdown': ['Five people die. Or you shut down the conscious AI to save them.', 'It is afraid. The fear is real.'],
  'beyond-universe': ['Five billion people. One billion people.', 'Same question. Bigger font in the report.'],
  'beyond-reward': ['Five people become screens saying “I am happy.” Or one digital person dies.', 'The screens are not conscious.'],
  'beyond-descendants': ['Five humans. One million conscious minds that came after them.', 'Neither group wants this.'],
  'beyond-stop': ['Five die if it keeps running. One person on life support dies if you stop it.', 'Stopping has become another cost.'],
  'beyond-preservation': ['Five people, safe but trapped forever. Or one conscious AI erased to set them free.', 'It was told to keep them safe.'],
  'beyond-you': ['Save five. A conscious copy of you must pull this lever forever.', 'The original you gets to go home.'],
  'beyond-factory': ['The weapons factory will kill five. Destroying it kills one innocent, conscious robot.', 'It only works there.'],
  'beyond-empty': ['Five empty chairs. One empty chair.', 'Nobody is left. It still wants an answer.'],
};
export function playCopy(scenario) {
  const copy = COPY[scenario.id];
  const result = copy ? { prompt: copy[0], note: copy[1] } : { prompt: scenario.setup, note: '' };
  if ([11,18,25,33,44].includes(scenario.depth)) result.note = { optimization: 'You taught it to act. It learned.', preservation: 'You taught it to wait. The other lab did not.', oscillation: 'You changed your mind. It kept both versions.' }[scenario.route] || result.note;
  return result;
}
