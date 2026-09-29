import type {MarkdownRenderChild} from "obsidian";
import {attachReadingPinnedOverview} from "../src/readingPinnedChordOverview";

class FakeReadingClassList {
	readonly names = new Set<string>();
	add(name: string): void {
		this.names.add(name);
	}
	remove(name: string): void {
		this.names.delete(name);
	}
}

class FakeReadingMutationObserver {
	static latest: FakeReadingMutationObserver;
	disconnected = false;
	constructor(readonly notify: () => void) {
		FakeReadingMutationObserver.latest = this;
	}
	observe(_element: HTMLElement, _options: MutationObserverInit): void {}
	disconnect(): void {
		this.disconnected = true;
	}
}

class FakeReadingWindow {
	readonly MutationObserver = FakeReadingMutationObserver;
	paddingTop = "24px";
	getComputedStyle(_element: HTMLElement): Pick<CSSStyleDeclaration, "paddingTop"> {
		return {paddingTop: this.paddingTop};
	}
}

class FakeReadingStyle {
	readonly properties = new Map<string, string>();
	setProperty(name: string, value: string): void {
		this.properties.set(name, value);
	}
	removeProperty(name: string): void {
		this.properties.delete(name);
	}
}

class FakeReadingElement {
	readonly style = new FakeReadingStyle();
	readonly ownerDocument = {defaultView: new FakeReadingWindow(), body: {}};
	paneAvailable = true;
	closest(_selector: string): FakeReadingElement | null {
		return this.paneAvailable ? this : null;
	}
	readonly classList = new FakeReadingClassList();
}

class FakeReadingRenderChild {
	readonly containerEl = new FakeReadingElement();
	readonly resizeCallbacks: (() => void)[] = [];
	registerDomEvent(_window: Window, _event: string, callback: () => void): void {
		this.resizeCallbacks.push(callback);
	}
	readonly cleanupCallbacks: (() => void)[] = [];
	register(callback: () => void): void {
		this.cleanupCallbacks.push(callback);
	}
	unload(): void {
		this.cleanupCallbacks.forEach((callback) => callback());
	}
}

describe("Reading-mode sticky overview", () => {
	test("sets the negative inset after Obsidian mounts an initially detached block", () => {
		const child = new FakeReadingRenderChild();
		const overview = new FakeReadingElement();
		overview.paneAvailable = false;
		attachReadingPinnedOverview(child as unknown as MarkdownRenderChild, overview as unknown as HTMLElement);
		expect(overview.style.properties.has("--chord-sheet-sticky-inset")).toBe(false);
		overview.paneAvailable = true;
		FakeReadingMutationObserver.latest.notify();
		expect(overview.style.properties.get("--chord-sheet-sticky-inset")).toBe("24px");
		expect(FakeReadingMutationObserver.latest.disconnected).toBe(true);
	});

	test("stops waiting for attachment if a detached block is unloaded", () => {
		const child = new FakeReadingRenderChild();
		const overview = new FakeReadingElement();
		overview.paneAvailable = false;
		attachReadingPinnedOverview(child as unknown as MarkdownRenderChild, overview as unknown as HTMLElement);
		child.unload();
		expect(FakeReadingMutationObserver.latest.disconnected).toBe(true);
	});
	test("compensates pane padding and refreshes it when resizing", () => {
		const child = new FakeReadingRenderChild();
		const originalOverview = new FakeReadingElement();
		attachReadingPinnedOverview(
			child as unknown as MarkdownRenderChild,
			originalOverview as unknown as HTMLElement
		);
		expect(originalOverview.style.properties.get("--chord-sheet-sticky-inset")).toBe("24px");
		originalOverview.ownerDocument.defaultView.paddingTop = "40px";
		child.resizeCallbacks[0]();
		expect(originalOverview.style.properties.get("--chord-sheet-sticky-inset")).toBe("40px");
		child.unload();
		expect(originalOverview.style.properties.has("--chord-sheet-sticky-inset")).toBe(false);
	});
	test("enables sticky positioning on the original overview and removes its overflow clipping", () => {
		const child = new FakeReadingRenderChild();
		const originalOverview = new FakeReadingElement();
		attachReadingPinnedOverview(
			child as unknown as MarkdownRenderChild,
			originalOverview as unknown as HTMLElement
		);
		expect(child.containerEl.classList.names.has("chord-sheet-sticky-block")).toBe(true);
		expect(originalOverview.classList.names.has("chord-sheet-sticky-overview")).toBe(true);
	});

	test("removes only the sticky classes when a reading view unloads", () => {
		const child = new FakeReadingRenderChild();
		const originalOverview = new FakeReadingElement();
		child.containerEl.classList.add("existing-code-block");
		originalOverview.classList.add("chord-sheet-chord-overview-container");
		attachReadingPinnedOverview(
			child as unknown as MarkdownRenderChild,
			originalOverview as unknown as HTMLElement
		);
		child.unload();
		expect(child.containerEl.classList.names).toEqual(new Set(["existing-code-block"]));
		expect(originalOverview.classList.names).toEqual(new Set(["chord-sheet-chord-overview-container"]));
	});
});
