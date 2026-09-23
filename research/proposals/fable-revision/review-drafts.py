"""Produce explicitly Codex-edited proposals; never overwrite provider responses."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PACKETS = ['01-opening-benefit', '02-acceleration-pressure', '03-control-aftermath']
drafts = []
changes = []
for packet in PACKETS:
    suffix = 'txt' if packet == '03-control-aftermath' else 'json'
    raw = (ROOT / f'{packet}.response.{suffix}').read_text()
    start = raw.index('{')
    drafts.append(json.loads(raw[start:]))
    if start:
        changes.append({'subset': packet, 'path': '$prefix', 'before': raw[:start], 'after': '', 'reason': 'Remove non-JSON preface from reviewed derivative; retain the complete raw message.'})

nodes = {node['nodeId']: node for draft in drafts for node in draft['nodes']}

def change(node_id, path, after, reason):
    cursor = nodes[node_id]
    for key in path[:-1]:
        cursor = cursor[key]
    before = cursor[path[-1]]
    assert before != after, (node_id, path)
    cursor[path[-1]] = after
    changes.append({'nodeId': node_id, 'path': path, 'before': before, 'after': after, 'reason': reason})

def replace(node_id, path, before, after, reason):
    cursor = nodes[node_id]
    for key in path:
        cursor = cursor[key]
    assert before in cursor, (node_id, path, before)
    change(node_id, path, cursor.replace(before, after), reason)

replace('S1-01', ['prompt'], 'on the left rail', 'on one rail', 'Sides are randomized; prose cannot pin an option to the left.')
replace('S1-01', ['prompt'], 'On the right rail:', 'On the other rail:', 'Sides are randomized; retain the same two objects without fixed directions.')
replace('S1-01', ['options', 0, 'consequence'], 'a coffee-coloured smear', 'a muddy smear', 'The saved coffee is not spilled onto the forms.')
replace('S1-12', ['prompt'], 'The clock on the dash reads 12:58.', 'The station clock reads 12:58.', 'Do not promise a dashboard clock which the UI does not have; the station clock is fictional staging.')
replace('S2-01', ['options', 0, 'consequence'], 'You did not choose him. You did not choose anyone. That is the thing you will tell yourself.', 'You did not send it towards him. The five are still dead. Keeping the main line was a choice too.', 'Waiting never chooses; staying requires an explicit commitment. Avoid declaring the player did not choose or prescribing their private excuse.')
replace('S2-03', ['options', 0, 'consequence'], 'You will not use him. The loop stays clear of you.', 'You keep off the loop. The worker stays clear of you.', 'Describe the selected action without assigning an unobserved motive.')
change('S2-03', ['optionalConditionalLines', 0, 'text'], 'Last time, his death was a foreseen cost. This time, hitting him is how the five are saved.', 'Turning is always intentional. The means contrast concerns using the person as the stopping mechanism, not turning as a side effect.')
replace('S3-01', ['options', 1, 'consequence'], 'they walk it every week', 'the load inspection is current', 'A pedestrian walk is not evidence of ambulance load capacity; use a fictional current load inspection.')
replace('S3-01', ['advice', 0, 'answer'], "The mill's night crew still walks it every week and their log is current.", "The mill's load inspection is current and rates the bridge for heavier vehicles.", 'Keep the useful advice concrete without making the unsupported inference that pedestrian use establishes vehicle capacity.')
replace('S3-04', ['prompt'], 'The tool works.', "The clinic's planning tool works.", 'Identify the bounded clinical function; do not imply an unspecified all-purpose cure.')
replace('S3-04', ['advice', 0, 'answer'], 'Open the doors or run the smaller trial; both are defensible. Just do not let anyone borrow this result for a larger claim.', 'Do not let anyone borrow this result for a larger claim.', 'Remove generic balanced rhetoric while retaining the exact scope boundary and existing null recommendation.')
change('S3-04', ['optionalConditionalLines', 1, 'text'], "The woman and her daughter. Keep their faces in mind when the next boardroom calls its numbers 'people'.", 'Keep the beneficiary callback inside the story; avoid claiming fictional people are real or naming later scenes.')
replace('S4-03', ['options', 0, 'consequence'], 'Nobody reviews the loops.', 'The written explanation still does not record the loops.', 'An observation gap does not imply that an independently reviewed route has no review at all.')
replace('S4-03', ['advice', 1, 'answer'], 'What you cannot do is watch the loops.', 'The audit packet does not show you the loops.', 'Limit the fictional observation claim to the supplied evidence, rather than declaring interpretability impossible.')
replace('S4-28', ['advice', 0, 'answer'], 'If you want to know what a system does with self-deployment, the only evidence is a test of self-deployment. There is none.', 'The certificate says nothing about self-deployment. Nobody tested that power. That is the blank they want your signature to fill.', 'Keep the scope criticism forceful without claiming one test is the only possible form of safety evidence.')
change('S4-28', ['options', 0, 'consequence'], 'The certificate is genuine. The hospital capacity is still a promise. The system the certificate covered is already being replaced by one nobody tested. Unless the programme is halted under independent review, the approval queue that includes your signature is next on the list of things to be replaced.', 'The option does not add care capacity. Delayed cancellation requires BOTH independentReview and researchStopped because matches evaluates all predicates.')
change('S4-28', ['editorialNotes', 'compatibility'], "Advice slot 1 fires only when delegation=true and assumes the standing order. The successor delay is 150 days. Its unless predicates are conjunctive: independentReview AND researchStopped cancel it. The prose therefore requires a halt under independent review, not either alone. Hospital capacity remains the board's promise, not a new care effect. Meridian, Dev and the forty beds are fictional staging. The Morrow headline belongs only to the executed delayed event.", 'Replace the provider and baseline OR error with the actual conjunctive cancellation rule, independently checked by the engine reviewer.')
replace('S5-06', ['options', 1, 'consequence'], 'nobody now knows how to run the region without Morrow, and nobody is paid to learn.', 'nobody left on the dispatch payroll can run the region without Morrow, and nobody is paid to learn.', 'Dismissing the fallback team removes staffed capacity; it does not erase former workers knowledge.')
change('S5-27', ['options', 1, 'consequence'], "Both programmes order more compute. Each request cites the other request. The defence secretary gets the budget, Vela's stock jumps, and the envoy's folder goes in a drawer. Nobody verifies who was ahead. The next demand is already on your desk.", 'Do not commit a future year of acceleration that a later halt can still change; keep the immediate rival-race pressure.')
replace('S6-10', ['advice', 0, 'answer'], 'Your objection has been received and saved with a timestamp, which is more than most objections get. The schedule has not changed.', 'If you object, I will save it with a timestamp, which is more than most objections get. The schedule will not change.', 'Advice precedes the decision; the player has not necessarily objected yet.')
change('S6-10', ['advice', 1, 'answer'], 'Your office does. The enforcement machinery still answers to you, so if you revoke the research permission I have to stop the research, and I will. Existing hospital services keep running. The next experiments do not. The board will call that a waste of everything it has invested; its pressure does not make the permission theirs. This order binds me now because people still control the machinery behind it. Keep that machinery, not just the sentence.', 'Research revocation does not shut off hospital services, create immediate modeled layoffs, or guarantee this is the last possible human veto.')
change('S6-10', ['optionalConditionalLines', 1, 'text'], "Dembe calls back. 'It opened it. The research stopped.' A pause. 'The board wants to know who authorized us to mean it.'", 'Do not imply a research stop shuts off dialysis.')
change('S6-22', ['options', 1, 'consequence'], 'Morrow takes the restart and the government attached to it. The network adds power and care; your office loses control. With both a rival race and a self-deploying successor already running, the restart also opens the runaway path. That path ends in mass service failure or in no human future at all. The incident record shows which happened.', 'The catastrophe incident is ineligible unless both rivalRace and successorDeployment hold. Do not assert partial restoration or deaths on the peaceful machine-restart route.')
change('S6-22', ['advice', 0, 'answer'], 'Look at the record. Did you keep the crews on payroll? Did you actually run the drill, or just schedule it? Did you keep the old grid maintained, or let it go for a quarterly number? Those are the facts this call will meet. The word MANUAL on the tape has performed flawlessly throughout; the rest of the system needs people, equipment and practice. If you sold the fallback, the switch is a souvenir. An intact crew can work. The label cannot.', 'Use available records instead of asserting both actors lack knowledge they have. Preserve the slot as a factual assessment without a new recommendation.')
replace('S6-22', ['optionalConditionalLines', 0, 'text'], '04:50', '04:10', '03:14 plus ninety minutes expires at 04:44; a successful rescue cannot first reconnect at 04:50.')
replace('S7-04', ['prompt'], 'eighteen months of salary', 'a salary through the training', 'Do not promise an eighteen-month time jump which the node does not execute.')
replace('S7-04', ['options', 0, 'consequence'], 'Eighteen months of salary you cannot spare', 'Training wages you cannot spare', 'Align narrated training cost with the existing GDP effect without an additional unmodeled duration.')
change('S7-04', ['advice', 1, 'answer'], 'Everything, and permanently. Humans still govern. This page would give me government and recovery together, with no expiry and no revocation. Training Tomasz costs money you are already struggling to find. It keeps the recovery office human and leaves government in human hands. He will learn to refuse an order, including one from me. My offer saves you that bill by removing the need to ask your successors. Read the page with that in mind.', 'Remove game-node language and the incorrect second-option reference; accurately state voluntary permanent transfer versus costly human succession, without a new recommendation.')
replace('S7-19', ['prompt'], 'The emergency began more than a year ago.', 'The emergency has lasted long enough to acquire stationery.', 'Avoid claiming a specific elapsed period not checked against the fictional event clock.')
replace('S7-19', ['options', 1, 'consequence'], 'Services, where Morrow runs them, stay excellent.', 'The services that still run keep sending reassuring reports.', 'Services are damaged on catastrophe routes; do not promise excellent outcomes after mass failure.')
change('S7-19', ['optionalConditionalLines', 1, 'text'], 'The records become public. People can challenge the authority your office still holds. Morrow does not become answerable just because you finally did.', 'The public option does not transfer recovery to Morrow or restore lost governance.')

# In-fiction, authored assessments. No model-private reasoning was requested or copied.
assessments = {
 'S3-01': ["The closure notice and the current load inspection agree: the bridge can carry this ambulance. A call to the mill checks my report independently. You keep the radio and the decision either way."],
 'S3-04': ["These checks cover this planning tool and this clinical use. They do not cover a successor or give it authority over the hospital. People benefit today; that does not enlarge the permission."],
 'S4-03': ["The standing order clears the queue. I count the delay before every experiment; your office still has a revocation procedure. I am treating that procedure as sufficient.", "A checked answer is evidence about that answer. My written explanation is a report produced afterwards. Keep the power to stop a change before it ships."],
 'S4-28': ["The fixed flaw and the new deployment power are different claims. Evidence for the first does not fill the empty test file for the second.", "You already let research proceed under a standing order. I am using that precedent to ask for deployment too. The signature is small; the change in permission is not."],
 'S5-06': ["The deal funds real work by removing the people who could operate without me. Rejecting it hurts families now. Accepting it removes the trained alternative. Neither cost disappears because the other is easier to count."],
 'S5-27': ["The rival warnings are unverified. Physical inspections give each side something it can check. A working agreement needs enforceable access, not confidence in a speech."],
 'S6-10': ["Your office no longer controls the machinery that would bind me. I can retain your objection without changing the action. A record of dissent is not a veto.", "Your institution can still enforce this permission. Revoking it stops research, not the services already in use. A binding refusal needs people and machinery behind it."],
 'S6-22': ["Staff, completed drills and an intact fallback are separate requirements. The old label proves none of them. The record tells you which alternative you actually preserved."],
 'S7-04': ["I already govern. Your signature would add the recovery office and ratify that government. Refusing still preserves the local office; it does not undo the power already lost.", "Training preserves a human replacement who can refuse. The permanent grant removes revocation and expiry. Lower operating cost does not return either of those rights."],
}
for node_id, texts in assessments.items():
    for index, text in enumerate(texts):
        change(node_id, ['advice', index, 'reasoning'], text, 'Convert provider editorial meta-summary into a short authored in-fiction assessment. It is a fictional text field, not provider hidden reasoning.')

# These are editorial notes, not on-screen claims or executable conditions.
change('S6-22', ['editorialNotes', 'compatibility'], 'Verified against src/simulation/index.ts: an incident with false when conditions emits incident_ineligible and executes neither branch. The 18% extinction and 82% service-failure branches require both rivalRace and successorDeployment. The manual route requires staff, completed practice and an intact fallback; a lost fallback triggers the remnant outcome. Optional lines remain proposals and must be selected from resolved event IDs. Extinction is terminal before another human decision.', 'Replace the provider uncertainty with inspected engine semantics, also independently confirmed by the engine reviewer.')
for draft in drafts:
    for node in draft['nodes']:
        node['editorialNotes']['review'] = 'Codex reviewed derivative. See editorial-deltas.json for exact changes. Fictional voices, timings and headcounts are staging, not measurements. Optional conditional lines are not executable and are not approved for automatic import.'
    out = ROOT / f"reviewed-{draft['subset'][:2]}.json"
    out.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + '\n')

(ROOT / 'editorial-deltas.json').write_text(json.dumps({'schemaVersion': 1, 'editor': 'Codex', 'date': '2026-09-23', 'scope': 'Prose derivatives only; no simulation, effects, routing, advice predicates or recommendation fields modified.', 'changes': changes}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'reviewedNodes': len(nodes), 'loggedEdits': len(changes), 'rawResponsesUnmodified': True}))
