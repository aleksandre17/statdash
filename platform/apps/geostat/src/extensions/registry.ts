// ── Extension registry singleton ─────────────────────────────────────
//
//  Single shared ExtensionRegistry for the runner.
//  Populated by setupExtensions() (called from setupRegistrations.ts).
//  Passed to <NodePageRenderer extensions={extensionRegistry} />.
//
//  This is the Option A pattern: module-level singleton, same as how
//  registerSlice / modeRegistry work in this codebase.
//
import { ExtensionRegistry } from '@statdash/react'

export const extensionRegistry = new ExtensionRegistry()
