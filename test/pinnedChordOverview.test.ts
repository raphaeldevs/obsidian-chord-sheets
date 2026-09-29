import {PinnedChordOverview, pinnedOverviewBounds} from "../src/pinnedChordOverview";
import {DEFAULT_SETTINGS} from "../src/chordSheetsSettings";
import {tokenizeLine} from "../src/sheet-parsing/tokenizeLine";
import {ChordToken, isChordToken} from "../src/sheet-parsing/tokens";

class FakeOverviewRenderer {
	static calls: {instrument: string; width: number | undefined; count: number}[] = [];
	static render(instrument: string, _container: HTMLElement, tokens: ChordToken[], width?: number): void {
		FakeOverviewRenderer.calls.push({instrument, width, count: tokens.length});
	}
}

jest.mock("../src/chordDiagrams", () => ({
	makeChordOverview: (instrument: string, container: HTMLElement, tokens: ChordToken[], width?: number): void =>
		FakeOverviewRenderer.render(instrument, container, tokens, width)
}));

class FakePanelElement {
	className = "";
	hidden = false;
	style: Partial<CSSStyleDeclaration> = {};
	children: FakePanelElement[] = [];
	removed = false;
	appendChild(child: FakePanelElement): void {
		this.children.push(child);
	}
	replaceChildren(child: FakePanelElement): void {
		this.children = [child];
	}
	remove(): void {
		this.removed = true;
	}
}

class FakePanelDocument {
	body = new FakePanelElement();
	createElement(_tag: string): FakePanelElement {
		return new FakePanelElement();
	}
}

function chordTokens(source: string): ChordToken[] {
	return tokenizeLine(source, 0, "%c", "%t").tokens.filter(isChordToken);
}

describe("Pinned overview bounds", () => {
	test.each([
		[0, 800, 20, 500, 10, 1000],
		[0, 800, 20, 500, 0, 1000],
		[0, 800, 20, 500, -100, 0],
		[0, 800, 20, 500, -100, -20],
		[0, 800, 20, 0, -100, 1000],
		[0, 0, 20, 500, -100, 1000]
	])("hides before/after a block or in a hidden pane (%s,%s,%s,%s,%s,%s)", (...bounds) => {
		expect(pinnedOverviewBounds(...(bounds as [number, number, number, number, number, number]))).toBeNull();
	});

	test("positions the panel without capping the height of wrapped diagrams", () => {
		expect(pinnedOverviewBounds(100, 700, 300, 400, -200, 900)).toEqual({
			top: 100,
			left: 300,
			width: 400
		});
	});

	test("keeps all wrapped diagrams available until the block leaves the pane", () => {
		expect(pinnedOverviewBounds(100, 700, 300, 400, -200, 140)).toEqual({top: 100, left: 300, width: 400});
	});
});

describe("Pinned overview lifecycle", () => {
	let fakeDocument: FakePanelDocument;
	let overview: PinnedChordOverview;
	beforeEach(() => {
		FakeOverviewRenderer.calls = [];
		fakeDocument = new FakePanelDocument();
		overview = new PinnedChordOverview(fakeDocument as unknown as Document);
	});

	test("starts hidden, uses pane coordinates, and hides when leaving a block", () => {
		const panel = fakeDocument.body.children[0];
		expect(panel.hidden).toBe(true);
		overview.place({top: 100, left: 300, width: 400});
		expect(panel.hidden).toBe(false);
		expect(panel.style).toEqual({top: "100px", left: "300px", width: "400px"});
		overview.place(null);
		expect(panel.hidden).toBe(true);
	});

	test("keeps diagrams during scrolling and refreshes for size, instrument or chord changes", () => {
		overview.setChords("guitar", chordTokens("C G C"), 100);
		overview.setChords("guitar", chordTokens("C G C"), 100);
		expect(FakeOverviewRenderer.calls).toEqual([{instrument: "guitar", width: 100, count: 2}]);
		overview.setChords("guitar", chordTokens("C G"), 70);
		overview.setChords("ukulele", chordTokens("C G"), 70);
		overview.setChords("ukulele", chordTokens("Am F"), 70);
		expect(FakeOverviewRenderer.calls).toHaveLength(4);
	});

	test("removes the floating panel at teardown", () => {
		overview.destroy();
		expect(fakeDocument.body.children[0].removed).toBe(true);
	});

	test("preserves the default size and makes pinning opt-in for existing installations", () => {
		expect(DEFAULT_SETTINGS.diagramWidth).toBe(100);
		expect(DEFAULT_SETTINGS.pinChordOverview).toBe(false);
		expect({...DEFAULT_SETTINGS, diagramWidth: 85}.diagramWidth).toBe(85);
	});
});
