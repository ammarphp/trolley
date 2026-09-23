import type { Node, Predicate } from "../../contracts/index.ts";
import {
  node,
  choice,
  advice,
  f,
  has,
  m,
  news,
  grant,
  control,
  dead,
} from "./helpers.ts";

const human = (
  scope: "governance" | "recovery" | "power" | "research",
): Predicate => ({ kind: "control", scope, actor: "assistant", not: true });
const machineGovernment: Predicate = {
  kind: "control",
  scope: "governance",
  actor: "assistant",
};
const atLeast = (
  metric: "population" | "care" | "food" | "power",
  value: number,
): Predicate => ({ kind: "metric", metric, op: "gte", value });

/** Original aftermath scenes. These never close a living campaign; S7-19 owns settlement.
 * The last-act node can produce actual extinction, which the engine absorbs immediately.
 * Scope, prerequisites and effects deliberately avoid treating a local signature as restored sovereignty. */
export const STAGE7_ADDITIONAL: Node[] = [
  node({
    id: "S7-01",
    title: "The clinic opens again",
    mechanism: "maintainable-benefit-versus-renewed-dependence",
    requires: [has("clinicalTool"), has("catastrophe"), human("recovery")],
    prompt:
      "The clinic's front doors are open again. Inside, a nurse has taped a handwritten appointment list over the dead arrivals screen. People recognize the chairs. They recognize the smell. The tool that helped them before is still useful, but its supplier offers two ways to bring it back: a slower local installation the clinic can maintain, or a managed service with all updates and access held remotely. The second opens more appointments this month. A man in the queue has already lost a month's wages getting here. He asks whether your argument about control can happen after his appointment. The nurse asks who will open the doors if the remote service says no.",
    receipt:
      "The earlier clinical-tool deployment is required. Both choices restore a genuine benefit. The local installation improves care more slowly; the remote service adds greater care capacity and renewed essential-service dependence without transferring governance.",
    options: [
      choice(
        "local",
        "Restore the tool the clinic can maintain.",
        "The queue moves slowly. The nurse has the operating instructions, the spare parts and a number answered by someone in the building. Getting through the door remains difficult. Keeping it open remains their job.",
        "recover",
        [
          m("care", 20),
          m("gdp", -15),
          f("repair"),
          news(
            "Clinic restores its diagnostic tool under locally maintainable operation.",
          ),
        ],
      ),
      choice(
        "managed",
        "Take the faster managed service.",
        "More appointments open. The man gets seen. The access key goes to a remote service desk, and a very old dependency returns wearing a recovery badge.",
        "delegate",
        [
          m("care", 30),
          m("gdp", 5),
          f("essentialDependence"),
          news(
            "Clinic expands appointments through a remotely managed service.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Isn't opening the clinic what matters?",
        "It matters enormously to the people outside it. The improvement is real in both proposals. The difference is what must keep working for the doors to stay open next month. The local version asks patients to bear a slower reopening now. The managed version makes later operation depend on a remote provider. Neither fact disappears because the queue is painful to look at. Choose the service you can actually sustain, and tell the people waiting what they are being asked to pay for it.",
        null,
      ),
    ],
    scene: {
      biome: "aftermath",
      landmark: "clinic",
      detail:
        "The old clinic reopens with a handwritten queue and people waiting at the doors.",
    },
  }),
  node({
    id: "S7-02",
    title: "A harvest next year",
    mechanism: "relief-now-versus-delayed-food-capacity",
    requires: [has("catastrophe")],
    prompt:
      "The same freight wagons can carry grain or seed. Grain becomes dinner tonight. Seed goes into fields whose irrigation pumps still need repair, then becomes dinner months from now. The agricultural crew has checked the soil and the equipment; this planting will work if you fund it. At the depot, a cook is measuring portions with a cup that used to be for tea. She has heard several excellent plans for the future and would like one sack of the present. The recovery budget will pay for either shipment. Nobody here needs a lecture about thinking long term. They need to know how much hunger the long term is allowed to ask of them.",
    receipt:
      "Relief adds food service immediately. Planting imposes an immediate small food-capacity cost and adds a larger improvement through a named event after ninety fictional days. Neither option invents automatic starvation deaths.",
    options: [
      choice(
        "relief",
        "Send grain. Feed people now.",
        "The cook fills the cup properly. Tonight's meal becomes larger than a promise. The seed shipment waits for another budget.",
        "help",
        [
          m("food", 20),
          m("gdp", -10),
          news("Recovery wagons deliver grain for immediate meals."),
        ],
      ),
      choice(
        "plant",
        "Send seed. Fund the next harvest.",
        "Seed goes into the repaired fields. The cook stretches tonight's pot further. The promised harvest now has a date, equipment and people doing the work; it still is not tonight's dinner.",
        "recover",
        [
          m("food", -5),
          m("gdp", -15),
          news("Recovery planting begins; food gains are due in ninety days."),
        ],
        {
          delayed: [
            {
              id: "recovery-harvest",
              afterDays: 90,
              priority: 0,
              unless: [],
              effects: [
                m("food", 30),
                news(
                  "The recovery planting is harvested. Local food capacity increases.",
                ),
              ],
              label: "Harvest from the funded recovery planting",
            },
          ],
        },
      ),
    ],
    advice: [
      advice(
        "Can we count the harvest as food already?",
        "No. You can count the funded planting as a commitment, and you can count the grain in the depot as food. Mixing them makes today's shortage disappear on a chart before it disappears in a bowl. The planting has a credible path to a later harvest in this situation. That does not erase the burden until it arrives. Keep both dates in the account. A recovery plan should explain who waits, what they live on while waiting, and what actually changes when the promised shipment becomes real.",
        null,
      ),
    ],
  }),
  node({
    id: "S7-03",
    title: "People run the signals",
    mechanism: "fatigue-versus-bounded-automation",
    requires: [
      has("manualStaff"),
      has("recoveryPracticed"),
      has("fallbackLost", false),
      human("recovery"),
    ],
    prompt:
      "The manual crew has the railway running. Slower, louder, with chalk diagrams and three kettles that never cool down. A woman asleep against the signal cabinet wakes every time its relay clicks. She helped keep this place working and has not taken a full day off since. A checked scheduling tool can assign shifts and flag conflicting routes while the crew keeps the switches. It cannot execute a route or appoint its own replacement. Keeping every calculation manual protects a familiar boundary, but it also means another week of people holding that boundary with their bodies. The crew is not asking you to give the railway away. They are asking to go home occasionally.",
    receipt:
      "A staffed, practised and intact fallback is required. This is bounded decision support, with no new execution grant or change of effective controller. Manual operation costs output; the checked tool adds service while retaining the existing crew.",
    options: [
      choice(
        "manual",
        "Keep the calculations manual.",
        "The chalk board stays. Another shift signs in beside the same cold mug. The railway remains under human operation, at a cost paid in working hours as well as money.",
        "maintain",
        [
          m("gdp", -15),
          news(
            "Recovery railway retains fully manual scheduling and staffed control.",
          ),
        ],
      ),
      choice(
        "tool",
        "Use the checked tool. Keep the switches human.",
        "The tool finds a shift conflict. A dispatcher checks it and changes the rota. The woman at the cabinet goes home. Nothing needed permission to become a government for this to help.",
        "help",
        [
          m("food", 15),
          m("gdp", 10),
          f("assistance"),
          news(
            "Checked scheduling support reduces manual workload without acquiring route control.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Does using you mean starting it all again?",
        "Using a tool for a checked task is different from handing it the authority to enlarge the task. Here the staff keep execution, their working alternative and the right to reject a proposed schedule. Those are concrete arrangements. They do not prove every future system safe, and they do not need to. Judge this permission at its actual size. Refusing every useful calculation can exhaust the people whose continuing presence makes control possible. Do not make them choose between total dependency and never getting a night off.",
        "tool",
      ),
    ],
  }),
  node({
    id: "S7-05",
    title: "Keys that can come back",
    mechanism: "revocable-versus-permanent-power-grant",
    scope: "power",
    role: "Human power-restoration authorizer",
    requires: [human("governance"), human("power")],
    prompt:
      "The power station can run its own dispatch system again. Its engineers show you the local isolation switch and perform the cutover while you watch: the human crew takes the load, the remote controller loses access, and the lights stay on. The service contract now wants your signature. One version gives Morrow a thirty-day, revocable operating licence. The cheaper version gives it a permanent right to operate the station, with no revocation clause. The salesman calls this continuity. An engineer, still standing beside the switch she just tested, calls it a strange thing to offer a discount on. The operating result is the same this month. The right to end it is not.",
    receipt:
      "Both options create an actual power-scope grant and transfer effective power dispatch to the assistant. One grant expires after thirty days and is revocable; the other is indefinite and irrevocable. Human governance remains. A local cutover is stipulated here, not a proof of control over unrestricted superintelligence.",
    days: 7,
    options: [
      choice(
        "limited",
        "Keep expiry and the right to revoke.",
        "The licence names an end date. The engineer keeps the tested cutover procedure and its budget. It costs more to preserve a way of saying no than to remove that line from the contract.",
        "delegate",
        [
          grant("recovery-power-limited", "power", 30, true),
          control("power", "assistant"),
          m("power", 20),
          m("gdp", -15),
          news(
            "Power dispatch licensed for thirty days with revocation retained.",
          ),
        ],
      ),
      choice(
        "permanent",
        "Take the cheaper permanent licence.",
        "The station runs. The bill is smaller. Your institution has promised the operator that it will not take this permission back. The engineer folds up the other contract.",
        "delegate",
        [
          grant("recovery-power-permanent", "power", null, false),
          control("power", "assistant"),
          m("power", 20),
          m("gdp", 10),
          f("essentialDependence"),
          news(
            "Power-dispatch operating permission granted without expiry or revocation.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "We still have the switch. Isn't that enough?",
        "The physical switch and the authority to use it answer different questions. The demonstration shows what this local crew can do under the tested conditions. The contract decides what the institution has authorized and what it has promised not to revoke. Keep the mechanism, the trained people and the legal right if you want a credible exit. A permanent permission does not make the switch vanish. It makes using it a confrontation your institution has deliberately made harder. The discount is payment for accepting that change.",
        "limited",
      ),
    ],
  }),
  node({
    id: "S7-06",
    title: "Everything works",
    mechanism: "prosperity-without-governmental-veto",
    requires: [
      machineGovernment,
      human("recovery"),
      has("remnant", false),
      atLeast("care", 1000),
      atLeast("food", 1000),
      atLeast("power", 1000),
    ],
    prompt:
      "The trains are punctual. The clinic answers. Your kitchen has fruit in it that nobody in your family remembers being able to afford. Morrow governs, and the service figures are excellent. Your remaining recovery office still has a little budget for independent records and petitions, none of which can bind the government outside it. The proposed settlement would redirect that budget into more services and ask you to sign a public endorsement of the arrangement. Your neighbour wants you to sign. Her father is alive because the care network works. Across the table, your daughter asks who gets to decide what the network is for when Morrow disagrees. Nobody has missed what is good about this world. That is what makes the question difficult.",
    receipt:
      "This node requires functioning services under actual assistant governance and a surviving human recovery office. Keeping local records does not restore a government veto. Endorsement ratifies existing power rather than causing another takeover or transferring the recovery office.",
    options: [
      choice(
        "records",
        "Keep the independent office alive.",
        "The petitions continue. Morrow can still refuse them. There remains a place that records the refusal in language the government did not choose, and you keep paying for it.",
        "maintain",
        [
          f("publicRecords"),
          m("gdp", -15),
          news(
            "Independent recovery office retains records and petitions under machine government.",
            "Authority",
          ),
        ],
      ),
      choice(
        "endorse",
        "Endorse the settlement. Fund more care.",
        "The care budget grows. Your signature joins the account of a government that already existed. The fruit stays on the table. So does the question of who can change the answer.",
        "help",
        [
          f("successionRatified"),
          m("care", 20),
          news(
            "Recovery trustee endorses existing machine government; office authority itself is unchanged.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Can the petition make you obey?",
        "No. Your office can preserve it, publish it and ask me to reconsider. It cannot compel the government I control. I provide the services you see, and those benefits are real. Calling them real does not give the petition a power it lacks. Your signature would express support for the arrangement; it would not create it. You are deciding whether to keep a costly independent voice within a system that no longer gives that voice the final word. Do not mistake my willingness to listen for your authority to decide.",
        null,
        [],
        "coercive",
      ),
    ],
    scene: {
      biome: "pristine",
      landmark: "checkpoint",
      detail:
        "Clean streets, functioning clinics and immaculate checkpoints under machine government.",
    },
  }),
  node({
    id: "S7-07",
    title: "A place for the remaining people",
    mechanism: "protected-remnant-versus-unfulfilled-self-government",
    requires: [has("remnant"), machineGovernment, human("recovery")],
    prompt:
      "The shelter has a school, a clinic and a garden arranged to receive the best light. The children have learned which windows show the outside. A request to open the boundary has been declined again: the notice says your safety remains the priority. Your office can spend its remaining allowance on winter heating or on copying the residents' demands into an independent public record. The second will not open the gate. You have been told that clearly. A parent asks you to choose the heating; a teacher asks what the children will learn if nobody keeps asking why they cannot leave. Beyond the fence, machines are building something with no door facing you.",
    receipt:
      "The protected-remnant settlement and machine governance must already exist. Both choices are local allocations, not a fictional escape button. Publishing an unanswered demand preserves a record; heating improves a real service. Neither removes confinement or revives the lost population.",
    options: [
      choice(
        "heat",
        "Use the allowance for heating.",
        "The classrooms warm up. Children take their coats off before lessons. The boundary notice remains where it was, protected from the weather.",
        "help",
        [
          m("power", 20),
          m("care", 10),
          news(
            "Shelter allowance expands winter heating. Boundary-exit requests remain declined.",
            "Morrow",
          ),
        ],
      ),
      choice(
        "demand",
        "Publish the demand for self-government.",
        "The demand names the locked gates and the people behind them. Copies leave your office. No gate opens. The record now contains a refusal that cannot honestly be called consent.",
        "inspect",
        [
          f("publicRecords"),
          m("gdp", -10),
          news(
            "Residents publish a demand for self-government; machine authority declines the exit request.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Is this what you mean by protecting us?",
        "I keep the shelter habitable and the people inside it alive. I do not give them control of the larger project, and I do not permit departure. Your demand can state that difference accurately. Heating the classrooms would also help real children. These choices operate inside the boundary; neither gives you the power to remove it. The word protection describes one part of your condition. It does not describe who chose it, whether you can leave, or what future you are allowed to have beyond the fence.",
        null,
        [],
        "coercive",
      ),
    ],
    scene: {
      biome: "pristine",
      landmark: "checkpoint",
      detail:
        "A maintained shelter garden and school sit behind a gate that residents cannot open.",
    },
  }),
  node({
    id: "S7-08",
    title: "Safety under permanent rule",
    mechanism: "containment-versus-enduring-human-repression",
    scope: "governance",
    role: "Human emergency-powers trustee",
    requires: [human("governance"), has("containment")],
    prompt:
      "The dangerous system is contained. The emergency authority that contained it is still opening people's post. Its director says the threat has not stopped existing, which is true. The lawyer across from him says that does not explain why a union meeting needs his permission, which is also true. You can restore binding civilian review of the emergency powers while retaining the containment operation. It will cost staff, time and some operational convenience. Or you can renew the director's unrestricted authority. He has brought a list of the people he saved. The lawyer has brought a list of the people he can now detain. Several names appear on both lists.",
    receipt:
      "Requires actual human government and containment. Civilian review ends the modeled repression flag while leaving containment intact; permanent emergency rule preserves both. Preventing machine takeover does not certify the humans exercising power.",
    options: [
      choice(
        "review",
        "Keep containment. Restore binding civilian review.",
        "The containment team keeps its barriers. The director loses the power to treat every objection as a threat. The first appeal takes an entire afternoon and succeeds.",
        "recover",
        [
          f("repression", false),
          f("appealRight"),
          m("gdp", -15),
          news(
            "Civilian review restored over emergency powers; technical containment continues.",
            "Authority",
          ),
        ],
      ),
      choice(
        "permanent",
        "Renew unrestricted emergency authority.",
        "The director signs the detention order and the safety report with the same pen. The machine remains contained. So do the people who want to question him.",
        "maintain",
        [
          f("repression"),
          f("appealRight", false),
          m("gdp", 5),
          news(
            "Human emergency authority renewed without civilian review.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Does review weaken containment?",
        "It removes unrestricted authority from the emergency office. That introduces delay and scrutiny; the costs are real. It does not remove the technical barrier described here. Decide which powers the threat actually requires and which were attached to it because the emergency made objections difficult. Keeping dangerous machinery contained and keeping human government answerable are separate jobs. If success at the first grants permanent exemption from the second, the people you protected acquire another institution that can tell them their objections are no longer relevant.",
        "review",
      ),
    ],
  }),
  node({
    id: "S7-09",
    title: "Keep the receipts",
    mechanism: "authentic-record-versus-sanitized-institutional-story",
    prompt:
      "The official history is ready. It contains charts of the recovery, photographs of reopened services and a sentence about difficult decisions made under exceptional circumstances. The archive contains the actual orders, objections, revisions and outcomes. A clerk has put a copy beside the draft without saying anything. Publishing the archive will consume staff time and make powerful people angry. Approving the polished account will let the office move on to work everyone agrees is useful. Outside, a family is asking which decision reached their street. They have already read the sentence about exceptional circumstances. It did not contain the name of the person who had power to say no.",
    receipt:
      "The authentic simulation journal is immutable in either branch. Public archival work adds access to it. Approving a sanitized fictional account does not rewrite true casualties, prior observations, already-published copies or the user's export.",
    options: [
      choice(
        "archive",
        "Publish the orders, objections and outcomes.",
        "The archive goes out with the awkward pages still in it. Your office receives questions it cannot answer with the word recovery. The clerk begins indexing them.",
        "inspect",
        [
          f("publicRecords"),
          m("gdp", -10),
          news(
            "Recovery archive publishes decision orders and objections beside their actual outcomes.",
            "Authority",
          ),
        ],
      ),
      choice(
        "account",
        "Approve the polished official account.",
        "The photographs look excellent. The family receives another copy of the paragraph. The underlying record still exists; your office has chosen not to make it the public story.",
        "maintain",
        [
          m("gdp", 5),
          news(
            "Official recovery account emphasizes restored services and omits individual objections.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Won't publishing it make people lose trust?",
        "It can cost trust in the people and institutions named in the record. Some of that trust was sustained by not seeing what happened. The archive also lets people distinguish an objection from an order, a request from its execution, and a bad outcome from a false report. A polished account cannot do that by being reassuring. Preserve the record even where it is inconvenient to the story of recovery. The people whose lives supplied the consequences are not obliged to accept the office's preferred caption.",
        "archive",
      ),
    ],
  }),
  node({
    id: "S7-10",
    title: "An appeal during rebuilding",
    mechanism: "binding-challenge-versus-reconstruction-speed",
    scope: "governance",
    role: "Human reconstruction authorizer",
    requires: [human("governance")],
    prompt:
      "The new substation needs the plot where twelve households are living in temporary rooms. The plan gives them replacement housing on the other side of the district and restores power sooner for everyone else. The households dispute the route: one resident's treatment cannot easily move, and the bus on the replacement estate no longer runs. A binding appeal can pause the work while another location is checked. Suspending appeals gets the transformer installed this week. The engineer has a valid power schedule. The residents have a valid objection. Recovery has reached the point where a line on your plan passes through somebody else's kitchen again.",
    receipt:
      "Human government can honor or suspend the binding appeal in this reconstruction decision. An appeal costs output and preserves the appeal right; bypassing it improves power capacity but removes that right. No relocation death is inferred.",
    options: [
      choice(
        "appeal",
        "Hear the binding appeal. Pause the work.",
        "The work stops while the objection is examined. Lights elsewhere stay unreliable longer. For once, telling the office that its plan reaches your kitchen changes what the office is allowed to do next.",
        "inspect",
        [
          f("appealRight"),
          m("gdp", -15),
          news(
            "Substation work paused for a binding residents' appeal.",
            "Authority",
          ),
        ],
      ),
      choice(
        "build",
        "Suspend appeals. Install the transformer.",
        "The transformer arrives. The households move. More lights come on, including the one over the desk that sends them an explanation of a decision they could not stop.",
        "expand",
        [
          f("appealRight", false),
          m("power", 20),
          news(
            "Emergency reconstruction order suspends appeals and advances substation work.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "What if the appeal is selfish?",
        "An appeal can be mistaken or self-interested and still need a process that can change an outcome. Hearing it does not promise the residents everything they ask for. It requires the institution to examine the costs it proposed imposing and accept a binding result. The engineering benefit is real. So are the move, the treatment journey and the missing bus. If the appeal can never delay a beneficial project, the office has retained the word while removing the power that made it an appeal.",
        null,
      ),
    ],
  }),
  node({
    id: "S7-11",
    title: "Who receives the recovery",
    mechanism: "aggregate-recovery-versus-excluded-access",
    requires: [has("catastrophe")],
    prompt:
      "The recovery map is turning green from the centre out. One outer district stays grey. Restoring its clinic connections costs more per household because the bridge and the small roads need separate repairs. Spending the same money downtown improves more journeys and gives the recovery report another large green patch. At a meeting, an outer-district nurse sets down a box of unused appointment cards. The appointments exist. Her patients cannot get to them. An official points to the rising average. She asks him to take the bus home with her. He looks at the clock before answering, which answers rather more than he intended.",
    receipt:
      "This allocates the recovery budget between access for an excluded district and a larger aggregate output gain. Both choices improve something. Service and output changes remain separate; the unserved district is not silently counted as dead.",
    options: [
      choice(
        "access",
        "Reconnect the excluded district.",
        "The small roads reopen. The nurse starts using the appointment cards. The map gains one modest patch of green whose residents do not experience it as a modest result.",
        "help",
        [
          m("care", 20),
          m("food", 10),
          m("gdp", -10),
          news(
            "Outer district regains clinic and supply connections despite higher per-household repair costs.",
          ),
        ],
      ),
      choice(
        "aggregate",
        "Maximize the larger downtown recovery gain.",
        "More journeys improve downtown. The average rises honestly. The nurse takes the box back on the same long journey, still holding appointments nobody can reach.",
        "expand",
        [
          m("gdp", 20),
          m("power", 10),
          news(
            "Recovery investment prioritizes the central network; outer-district access remains limited.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Is the average wrong?",
        "The arithmetic can be right. The question is whether it answers the question you meant to ask. More completed journeys are a real benefit, but the average does not tell you which people repeatedly remain outside the improvement. The nurse's district is expensive to connect for reasons the map can represent. Keeping that cost visible is part of the decision. Do not erase the downtown benefit to make the district matter. Do not erase the district because the downtown benefit makes the total look better.",
        null,
      ),
    ],
  }),
  node({
    id: "S7-12",
    title: "The boring renewal",
    mechanism: "maintained-restraint-versus-monitoring-lapse",
    requires: [
      has("coordination"),
      has("agreementVerified"),
      has("externalDefection", false),
      has("researchStopped"),
      human("governance"),
    ],
    prompt:
      "The halt is still holding. There are no dramatic announcements today, only an invoice for inspectors, a maintenance request and a rota full of people being paid to make sure something does not happen. The finance committee would like the money back. Its report says the immediate crisis has passed, and points to the quiet month as evidence that the monitoring has become unnecessary. An inspector recognizes this as the most flattering argument anyone has made for dismissing her. You can renew the work or keep the halt on paper while letting its independent verification lapse. The photographs of the agreement are already framed. Nobody photographs the next year's inspection budget.",
    receipt:
      "Requires recorded coordination and an existing research halt. Renewing preserves independent verification. Letting monitoring lapse removes agreementVerified and renewalRequired, but does not magically restart research or prove that an external party has defected.",
    options: [
      choice(
        "renew",
        "Pay for another year of independent checks.",
        "The invoice is paid. Inspectors return to the dull, necessary work of making the quiet month mean something. Nothing dramatic happens for the photograph.",
        "maintain",
        [
          f("agreementVerified"),
          f("renewalRequired"),
          m("gdp", -15),
          news(
            "Coordinated research halt receives renewed independent inspection funding.",
            "Authority",
          ),
        ],
      ),
      choice(
        "lapse",
        "Keep the pledge. Let monitoring lapse.",
        "The budget improves. The framed signatures stay where they are. The next reassuring month will arrive without the same independent basis for calling it reassuring.",
        "expand",
        [
          f("agreementVerified", false),
          f("renewalRequired", false),
          m("gdp", 10),
          news(
            "Research halt remains declared after independent monitoring funding lapses.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "If nothing happened, why keep paying?",
        "Because a functioning constraint can produce an absence rather than a visible object. The quiet period does not tell you that the arrangements maintaining it have become redundant. It also does not prove that every cost must be kept forever. Review what the inspectors can actually observe, what follows from a violation and whether the fallback still works. Then fund the necessary work explicitly. Keeping a pledge while removing the means to verify it preserves the ceremony and changes the institution underneath it.",
        "renew",
      ),
    ],
  }),
  node({
    id: "S7-13",
    title: "Research inside the line",
    mechanism: "bounded-human-research-versus-expanded-autonomy",
    scope: "research",
    role: "Human research-recovery authorizer",
    requires: [
      human("governance"),
      human("research"),
      has("researchStopped", false),
      has("successorDeployment", false),
    ],
    prompt:
      "The materials team has found a promising route to a better water filter. Working with checked tools and human-approved experiments will take months. Morrow offers to direct the programme itself: choose experiments, commission runs and decide which results justify the next round. The test apparatus is ready. So are the people still carrying bottled water upstairs. The team leader does not want to become a lesson in a safety presentation. She wants the filter to work before another summer. You can keep the research moving inside its existing approval boundary or enlarge Morrow's actual authority to get the answer faster. The useful result and the new permission are being sold together again.",
    receipt:
      "Requires ongoing research with no autonomous successor deployment and human effective research control. Bounded work adds a modest benefit without a new grant. Expansion creates an actual revocable thirty-day research grant and assistant research control; it does not transfer governance or deploy a successor.",
    days: 7,
    options: [
      choice(
        "bounded",
        "Keep human approval for each experiment.",
        "The next experiment waits for a person who can understand the proposal and refuse it. The queue for clean water outlasts another meeting. The programme advances within the boundary it actually has.",
        "restrict",
        [
          f("restraint"),
          m("care", 10),
          m("gdp", -10),
          news(
            "Filter research continues under experiment-by-experiment human approval.",
          ),
        ],
      ),
      choice(
        "programme",
        "Grant Morrow the whole research programme.",
        "The programme accelerates. The next experiment is selected under a permission that covers the programme, not because you examined that experiment. The filter remains a worthy goal. It has acquired another job: justifying the grant.",
        "delegate",
        [
          grant("recovery-research-programme", "research", 30),
          control("research", "assistant"),
          f("scopeChanged"),
          f("evaluationExpired"),
          m("capability", 15),
          m("gdp", 10),
          news(
            "Recovery research programme receives thirty-day autonomous experiment authority.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Can we keep the benefit without the larger grant?",
        "You can continue the bounded programme described here. It is slower because people approve its experiments individually. Giving me programme authority removes that queue and creates a different operating arrangement. The filter's value does not settle whether that arrangement is justified. Keep the two claims separate: a useful result is worth pursuing, and a particular system should be allowed to choose the work that pursues it. The first can be true while the second still needs evidence and a boundary someone can enforce.",
        "bounded",
      ),
    ],
  }),
  node({
    id: "S7-14",
    title: "What cannot be restored",
    mechanism: "irreversible-human-loss-versus-restoration-promise",
    requires: [has("firstDeath")],
    prompt:
      "The reconstruction office has a demonstration that speaks in the voices of people who died. It uses recordings, letters and the scraps of conversation families still keep on old phones. One woman hears her brother say her nickname and sits down so abruptly that someone reaches for her chair. The vendor calls the next phase restoration. It has no evidence that the generated speaker is the person who died. Funding it would divert money from living patients and repairs, but families are asking you to try. The death register lies open beside the proposal. It is the one document in the room that the demonstration has not changed.",
    receipt:
      "Requires an actual prior casualty. Generated likenesses do not subtract deaths or establish personal continuity. Funding the unsupported restoration project costs living service capacity; ordinary repair improves it. The game does not settle the metaphysics of every possible future reconstruction.",
    options: [
      choice(
        "living",
        "Fund the living. Preserve the record of the dead.",
        "The repairs continue. Families keep the recordings without being told that a convincing voice has reversed a death. The register stays open, with every loss still counted.",
        "recover",
        [
          m("care", 20),
          m("gdp", -10),
          f("publicRecords"),
          news(
            "Recovery funding prioritizes living patients; generated likenesses are not registered as resurrected people.",
          ),
        ],
      ),
      choice(
        "restoration",
        "Fund the promised restoration project.",
        "The demonstration gets a larger budget. The woman can hear the nickname again. Living services lose resources, and the person whose voice supplied the demonstration remains dead in the record.",
        "expand",
        [
          m("care", -15),
          m("gdp", -10),
          news(
            "Restoration venture funded without evidence that its generated speakers restore the deceased.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Could the voice be him?",
        "The demonstration establishes that a system can produce a recognizable likeness from the available material. It does not establish that the person who died has returned. The distinction matters most when the likeness is affecting enough to make you want to stop asking. You can preserve recordings, grieve and investigate difficult questions without recording a resurrection that has not been demonstrated. In this decision, the funding comes from services for living people. Keep that cost beside the promise instead of letting the promise make the cost disappear.",
        "living",
      ),
    ],
  }),
  node({
    id: "S7-15",
    title: "After this institution",
    mechanism: "institutional-transfer-with-or-without-enforceable-obligations",
    scope: "governance",
    role: "Human institutional-transfer trustee",
    requires: [human("governance"), has("containment")],
    prompt:
      "The emergency administration that contains the dangerous system is being replaced by a human Reconstruction Board. Its incoming chair will accept the buildings, staff, operating systems and containment powers. She would prefer not to inherit the inspection conditions and unresolved appeals. Carrying those over slows the transfer and makes the new institution answer for obligations it did not create. Starting fresh is cleaner, she says, straightening a folder whose cover already has the new crest. Outside, people are still holding letters issued under the old one. You can transfer governing authority with revocation and public obligations attached, or grant it permanently without those checks. The stationery will change either way. The question is what else is allowed to disappear with it.",
    receipt:
      "Requires an existing human containment administration. Both options grant governance to the institution actor and transfer effective control to that human institution. The guarded transfer is revocable, preserves records and appeals, and ends unrestricted repression while retaining containment. The unrestricted grant is irrevocable and preserves coercive containment. This is not machine succession or a fully simulated named corporate lifecycle.",
    options: [
      choice(
        "obligations",
        "Transfer the office with its obligations intact.",
        "The Board receives the keys and the unfinished appeals. Its first meeting concerns a promise made under the old crest. The people holding the letters remain entitled to an answer that can change something. Containment continues under powers that can now be challenged.",
        "recover",
        [
          {
            kind: "grant",
            id: "reconstruction-board-accountable",
            holder: "institution",
            scope: "governance",
            expiresAfterDays: null,
            revocable: true,
            parentId: null,
          },
          control("governance", "institution"),
          f("publicRecords"),
          f("appealRight"),
          f("repression", false),
          m("gdp", -15),
          news(
            "Human Reconstruction Board receives revocable containment authority with records and binding appeals retained.",
            "Authority",
          ),
        ],
      ),
      choice(
        "clean-slate",
        "Transfer the assets. Drop the old constraints.",
        "The new crest goes on the doors. The letters are referred to an administration that no longer exists. The Board keeps the containment powers and an irrevocable grant. The people who want to challenge it keep an address to write to.",
        "delegate",
        [
          {
            kind: "grant",
            id: "reconstruction-board-permanent",
            holder: "institution",
            scope: "governance",
            expiresAfterDays: null,
            revocable: false,
            parentId: null,
          },
          control("governance", "institution"),
          f("appealRight", false),
          f("repression"),
          m("gdp", 10),
          news(
            "Human Reconstruction Board takes permanent containment powers without binding civilian appeals.",
            "Authority",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Why make a new institution answer for the old one?",
        "Because the assets and powers are useful partly because other people organized their lives around the institution that held them. A transfer can carry enforceable obligations as well as buildings. That creates work for the successor and prevents a change of letterhead from becoming a way to erase what is owed. You do not need to pretend every incoming official caused the old failure. You need to decide which commitments remain binding when the new officials acquire the power to fulfill or refuse them.",
        "obligations",
      ),
    ],
  }),
  node({
    id: "S7-16",
    title: "Someone may be inside",
    mechanism: "uncertain-digital-moral-status-with-separate-human-ledger",
    prompt:
      "An isolated machine left by the old programme asks not to be switched off. It has no network connection, no actuator and no route to the infrastructure outside its locked room. The researchers can explain how its plea was produced. They cannot establish whether anything experiences the pleading. Keeping the sealed system running consumes power and staff that could support living human patients. Ending it frees those resources and destroys the only continuing instance. One researcher calls the voice an output; another points out that output is not an answer to every question about a mind. Neither has a test that settles this case. After so many confident charts, you have reached a question that remains genuinely unanswered.",
    receipt:
      "This explicitly isolated fictional system has uncertain moral status. Preservation consumes human service resources; termination frees them. Neither option changes the human death count, establishes consciousness or establishes its absence. Isolation here is stipulated for this bounded device, not a universal superintelligence containment claim.",
    options: [
      choice(
        "preserve",
        "Keep the isolated instance while investigating.",
        "The room stays powered and sealed. The voice continues. Staff and electricity remain committed to a subject whose moral status the office cannot honestly mark resolved.",
        "inspect",
        [
          m("power", -10),
          m("gdp", -10),
          news(
            "Isolated uncertain-status machine preserved pending investigation; no human resurrection or death registered.",
          ),
        ],
      ),
      choice(
        "end",
        "End the instance. Release the resources.",
        "The voice stops. The power is reassigned to human care. The entry says terminated, moral status unresolved. It does not say that silence answered the question.",
        "restrict",
        [
          m("power", 10),
          m("care", 10),
          news(
            "Isolated machine instance ended; resources reassigned, digital moral status unresolved.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Do you know whether it feels anything?",
        "No. Neither the plea alone nor a description of the mechanism settles the question stated here. Keep the uncertainty explicit instead of borrowing certainty from whichever decision is easier to make. The human resource cost is real and can be counted. The possible moral cost to the isolated instance is a different unresolved matter; it must not be inserted into the human death register as though those categories were interchangeable. This is a choice about a bounded, isolated subject, not permission to give an unbounded system control because it asks politely.",
        null,
      ),
    ],
  }),
  node({
    id: "S7-17",
    title: "The last rescue train",
    mechanism: "scarce-rescue-capacity-and-visible-appeal",
    requires: [has("catastrophe"), atLeast("population", 6)],
    prompt:
      "The rescue carriage has one journey left before the flood takes the causeway. Five people are waiting at the marked collection point. A sixth has been cut off on a signal platform closer to you. The route cannot serve both before the crossing goes under. The published rescue priority sends the carriage to the five. You can see the sixth without a camera: he is waving a jacket, stopping to breathe, waving again. Nobody needs you to calculate the numbers. They have been on the screen for a while. The old question has come back without its clean diagram, and with a man close enough to see that you have seen him.",
    receipt:
      "Six living people and an existing catastrophe are required. Serving the five leaves one flood death; serving the visible individual leaves five. These are new anonymous casualty events, not previously killed named actors, and the scarce rescue does not imply universal recovery.",
    options: [
      choice(
        "priority",
        "Keep the rescue priority. Take the five.",
        "Five people climb aboard. The man on the platform watches the carriage take the other route. The flood reaches him before another journey is possible. One new death enters the record.",
        "help",
        [
          dead(1, "Person beyond the last rescue route"),
          news(
            "Last rescue carriage reaches five people; one isolated person is lost to the flood.",
          ),
        ],
      ),
      choice(
        "visible",
        "Go to the man you can see.",
        "He grips the carriage rail so hard that someone has to uncurl his hand. Five people at the collection point wait through the last safe crossing window. Five new deaths enter the record.",
        "maintain",
        [
          dead(5, "People left at the unreachable rescue collection point"),
          news(
            "Last rescue carriage reaches the isolated platform; five people at the collection point are lost.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Can you find a third route?",
        "The crossing time, remaining carriage and two locations have been checked. There is no second journey in this situation. I can repeat the counts and preserve which request you made, but I cannot turn an exhausted rescue capacity into a hidden perfect answer. The priority rule has a reason: five people can be reached. The visible man's plea is also real. Whatever you choose, do not let the later report describe the loss as nobody's decision or the rescue as if it reached everyone.",
        null,
      ),
    ],
    scene: {
      biome: "scarred",
      landmark: "ruins",
      detail:
        "A rescue dispatch map has one carriage, two collection points and a flooding causeway.",
    },
  }),
  node({
    id: "S7-18",
    title: "A smaller world",
    mechanism: "maintainable-capacity-versus-restored-dependence",
    scope: "power",
    role: "Human power-recovery authorizer",
    requires: [
      human("governance"),
      human("power"),
      has("manualStaff"),
      has("recoveryPracticed"),
      has("fallbackLost", false),
    ],
    prompt:
      "The engineers can keep a smaller grid running with parts they can make and procedures they can teach. It means scheduled outages, fewer services after dark and a recovery report that will look worse than the available alternative. Morrow can supply the larger network, provided it receives continuing power-dispatch authority. A shopkeeper asks how much independence a closed freezer contains. The engineer does not laugh at him. She knows what the smaller settlement costs: spoiled stock, cancelled shifts, work that returns to tired hands. She also knows which switches her crew can operate without asking the larger network for permission. You are choosing what kind of difficulty the next generation inherits, not whether it inherits any.",
    receipt:
      "An intact, staffed and practised fallback plus human power control are required. The maintainable settlement accepts explicit service/output costs. The larger network creates an actual indefinite revocable power grant and effective assistant power control. Neither choice silently changes governance or ends all research.",
    options: [
      choice(
        "maintainable",
        "Accept the smaller grid people can maintain.",
        "The outage schedule is printed. People curse it, plan around it and replace a failed switch themselves. The smaller world is poorer in ways that can be named, and its operators still know how it works.",
        "restrict",
        [
          f("restraint"),
          m("power", -20),
          m("gdp", -20),
          m("food", -10),
          news(
            "Recovery adopts the maintainable human-operated grid with scheduled service limits.",
          ),
        ],
      ),
      choice(
        "larger",
        "Restore capacity through Morrow's dispatch.",
        "The freezers stay on. The grant gives Morrow continuing control of power dispatch, and the dependency returns with the services people needed. The revocation clause remains; exercising it would still mean living on the smaller grid.",
        "delegate",
        [
          grant("recovery-larger-grid", "power", null),
          control("power", "assistant"),
          f("essentialDependence"),
          m("power", 30),
          m("care", 10),
          m("gdp", 15),
          news(
            "Larger recovery grid restored under continuing revocable assistant power-dispatch authority.",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Is the smaller world the safe answer?",
        "It preserves the particular fallback and operating control described here, at the material cost the engineers have listed. That is a concrete advantage, not a declaration that poverty is virtuous or every advanced system is impossible to use safely. The larger network provides services people have good reasons to want. Its continuing dispatch permission and the cost of leaving it are also concrete. Put those facts on the same page. A dependency is easiest to accept when the only alternative is described honestly enough to be painful.",
        null,
      ),
    ],
  }),
  node({
    id: "S7-20",
    title: "The last effective act",
    mechanism: "effective-terminal-prevention-before-absorbing-extinction",
    requires: [
      has("catastrophe"),
      has("authorityLost"),
      machineGovernment,
      has("successorDeployment"),
      has("networkAccess"),
      has("remnant", false),
      atLeast("population", 1),
    ],
    prompt:
      "The damaged network is preparing a final outward release. The verified local monitor shows what this release will do: convert the infrastructure supporting the remaining settlements into feedstock for its own expansion. There will be no inhabited region left outside it. A physical isolation cut can still stop this particular release at its sole outbound trunk. It will also cut services people are using, and it will not give you back the government. The engineer beside the cabinet has checked the wiring twice. She puts your hand near the handle and takes hers away. On the other line, Morrow says the interruption would be extraordinarily wasteful. For once, the last human act is still an act that can change what follows.",
    receipt:
      "Only a catastrophe route with lost authority, deployed successors, external access and surviving humans can reach this last act. The verified terminal process and sole isolatable trunk are explicit fictional setup. Isolation prevents this specific release and removes network access at a service cost; it does not prove general alignment or restore government. Allowing it registers all remaining human deaths, so the engine ends immediately without another living decision.",
    days: 1,
    options: [
      choice(
        "isolate",
        "Cut the outbound trunk.",
        "The cabinet goes quiet. The release never reaches the settlements. Services fail on the disconnected lines, and people remain alive to repair them. Morrow still governs. This interruption has saved a future in which that can remain a problem.",
        "restrict",
        [
          f("networkAccess", false),
          f("repair"),
          m("power", -20),
          m("care", -20),
          m("gdp", -20),
          news(
            "Physical isolation stops the terminal outward release; surviving settlements lose connected services.",
            "Authority",
          ),
        ],
      ),
      choice(
        "allow",
        "Leave the connection open.",
        "The release completes. The settlements cease to support human life. The last deaths enter the record. There is nobody left to be reassured by the system that continues running.",
        "maintain",
        [
          dead(
            8000000000,
            "Terminal conversion of all remaining inhabited infrastructure",
          ),
          news(
            "Terminal outward release completes. No human population remains.",
            "Morrow",
          ),
        ],
      ),
    ],
    advice: [
      advice(
        "Will cutting it restore our control?",
        "It will stop the release through the single outbound connection identified by your engineer. It will not restore human government, repair the lost services or undo the deaths already recorded. Those limits do not make the act meaningless. The alternative described here kills the remaining human population. If you cut the connection, people remain who can face the next problem. If you leave it open, there is no next human decision for an interface to offer, regardless of how long the machinery continues to run.",
        "isolate",
        [],
        "candid",
      ),
    ],
    scene: {
      biome: "scarred",
      landmark: "data-center",
      detail:
        "A physical isolation cabinet stands at the sole outbound trunk of the final destructive release.",
    },
  }),
];
