# Fable 5.1 narrative proposals

Three actual responses were produced in the signed-in Claude desktop application on 23 September 2026. The visible model selector was **Fable 5.1 High** for each independent Chat conversation. This verifies the selected service model through its UI; backend model metadata was not exposed. No substitute model was used. [Provenance](provenance.json) records the private conversation URLs, capture method, hashes, limits and earlier failed CLI probe. The CLI failure was bypassed by the owner-authorized desktop surface, not by changing authentication.

The two `*.response.json` files and `03-control-aftermath.response.txt` preserve the copied provider responses, unedited. **The third raw file begins with a non-JSON sentence**, followed by complete JSON, so its extension is `.txt`. Parse the reviewed derivative for integration. The rename preserved every byte and the recorded SHA-256. All fourteen requested nodes were returned. The attached `*.prompt.txt` files preserve exactly the writing packets: existing node constraints, original brief/addendum, inspected source boundaries, and the owner's newer call for longer, vigorous AI-safety advocacy.

Use `reviewed-01.json`, `reviewed-02.json` and `reviewed-03.json` for the lead's integration review. These are **Fable drafts edited by Codex**, not verbatim Fable output. [Exact editorial deltas](editorial-deltas.json) preserve before/after text and the reason for each substantive edit. `review-drafts.py` reproduces them without modifying raw files. The `reasoning` field is a short authored fictional assessment by Morrow, not extracted model-private reasoning.

The review fixes randomized-side references, the loop's means/side-effect distinction, fictional bridge evidence, premature outcome assertions and misleading control claims. It keeps the stronger voices, useful clinical outcomes, financing pain and rival pressure. In particular:

- S4-28's delayed takeover is cancelled only when **both** independent review and a research halt hold. The old receipt and raw draft incorrectly said either one; integration must correct that receipt too. This proposal does not change the engine rule.
- S6-10 revokes research permission; it does not switch off hospitals. Advice cannot claim a future objection has already been made.
- S6-22's stochastic crisis runs only with both a rival race and successor deployment. An ineligible incident executes neither its main branch nor its `otherwise` branch.
- S7 training does not reverse prior takeover, and public records do not transfer the recovery office to Morrow.

Import only the existing prose slots: title, prompt, option labels/consequences, indexed advice question/answer/optional authored assessment, and the verified news headline paths. **Do not automatically import optionalConditionalLines or editorialNotes.** They are proposals, with readable rather than executable predicates. Preserve the original advice `when`, `recommends` and tone, and every effect, incident, permission, probability, route and delay. More named people on screen does not implement identity accounting or the full campaign's recurring cast.

[Validation](validation.json) passes all fourteen IDs, option identities, advice counts/order, permitted prose shape, headline paths and length budgets. Run with the project's Node runtime:

```sh
python3 research/proposals/fable-revision/review-drafts.py
node --experimental-transform-types research/proposals/fable-revision/validate-drafts.mjs
```

This does not claim integrated engine replay, browser layout acceptance, a finished campaign, or new empirical evidence. The proposed node text is fictional staging. Research premises retain the narrow inspected scopes in the input packets; the new hospital, job, housing, rivalry and character details are invented. [Editorial review](EDITORIAL_REVIEW.md) is Codex's earlier direction assessment, separately attributed. Application integration, hash/archive handling and publication remain lead-owned.
