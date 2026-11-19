import { readFileSync } from "node:fs";
import { app } from "electron";
import { useState } from "react";

export const random = Math.random();
export const clock = new Date();
export const browser = window.location;
export const title = document.title;
export { app, readFileSync, useState };

export { readFile } from "node:fs/promises";
export { writeFileSync } from "fs";
