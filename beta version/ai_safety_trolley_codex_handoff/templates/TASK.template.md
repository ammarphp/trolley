# Task packet: <ID> — <title>

Status: <ready / in_progress / review / blocked / done / deferred>
Owner role and agent: <role / actual agent identifier>
Reviewer: <role / actual reviewer>
Phase / acceptance gate: <phase / gate>
Release profile: <local story / remote statistics / formal study / all>

## Objective and reason for doing it now

<One bounded outcome; identify the owner requirement and prerequisite that make it ready.>

## Inputs and frozen interfaces

Required read paths: <exact files/sections, not the entire repository>
Prerequisite task IDs: <IDs>
Relevant engine/content/config versions: <actual versions>
Contracts not to change: <names/paths>
Source/claim requirements: <locators and required reading depth>

## Write reservation

Allowed files/subtrees: <precise, non-overlapping>
Explicitly prohibited paths: <shared contracts, lockfiles, neighboring owners>
Branch/worktree: <actual path or shared-checkout reservation>
Cross-boundary change process: <small request to coordinator before edits>

## Required deliverables

<Implementation, content, schema, test, asset, document, or review artifact. Mark prototype versus production explicitly.>

## Non-goals

<What must not be redesigned or added.>

## Acceptance and verification

Behavior to demonstrate: <observable outcomes>
Invariants/edge cases: <specific conditions>
Test commands or test specification: <actual known commands; do not invent existing scripts>
Visual/manual/source review: <required evidence and reviewer>
Definition of done: <conditions that must all pass>

## Return format

Changed files and diff/commit: <actual>
Decisions and rationale: <concise>
Tests executed and results: <command, result, evidence path>
Source reading actually performed: <scope and locators>
Unverified items / blockers: <specific>
Integration or migration needs: <specific>
Next ready task or handoff: <ID/path>
