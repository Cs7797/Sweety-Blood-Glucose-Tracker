import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
