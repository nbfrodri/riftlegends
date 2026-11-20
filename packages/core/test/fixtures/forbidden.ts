import { readFileSync } from "node:fs"; // noRestrictedImports
import { app } from "electron"; // noRestrictedImports
import { useState } from "react"; // noRestrictedImports

export const random = Math.random(); // noRestrictedGlobals
export const clock = new Date(); // noRestrictedGlobals
export const browser = window.location; // noRestrictedGlobals
export const title = document.title; // noRestrictedGlobals
export { app, readFileSync, useState };

export { readFile } from "node:fs/promises"; // noRestrictedImports
export { writeFileSync } from "fs"; // noRestrictedImports

export const elapsed = performance.now(); // noRestrictedGlobals
export const entropy = crypto.getRandomValues(new Uint32Array(1)); // noRestrictedGlobals
export const uuid = crypto.randomUUID(); // noRestrictedGlobals
export const instant = Temporal.Now.instant(); // noRestrictedGlobals
export const nanos = process.hrtime.bigint(); // noRestrictedGlobals
export const viaGlobalThis = globalThis.performance.now(); // noRestrictedGlobals
export const viaGlobal = global.crypto.randomUUID(); // noRestrictedGlobals
export const viaSelf = self.crypto.randomUUID(); // noRestrictedGlobals
export const formattedNow = new Intl.DateTimeFormat().format(); // noRestrictedGlobals
export const stamp = new Event("tick").timeStamp; // noRestrictedGlobals
export const timeout = setTimeout(() => {}, 10); // noRestrictedGlobals
export const interval = setInterval(() => {}, 10); // noRestrictedGlobals
export const frame = requestAnimationFrame((timestamp) => timestamp); // noRestrictedGlobals

export { randomBytes } from "crypto"; // noRestrictedImports
export { performance as nodePerformance } from "perf_hooks"; // noRestrictedImports
export { hrtime } from "process"; // noRestrictedImports
export { uptime } from "os"; // noRestrictedImports
export { setTimeout as schedule } from "timers"; // noRestrictedImports
export { setInterval as ticks } from "timers/promises"; // noRestrictedImports

export const requiredEntropy = require("crypto").randomUUID(); // noRestrictedGlobals
export const mark = new PerformanceMark("start").startTime; // noRestrictedGlobals
export const idle = requestIdleCallback((deadline) => deadline.timeRemaining()); // noRestrictedGlobals
export const deadline = AbortSignal.timeout(10); // noRestrictedGlobals
export const observations = new PerformanceObserver(() => {}); // noRestrictedGlobals
export const immediate = setImmediate(() => {}); // noRestrictedGlobals
