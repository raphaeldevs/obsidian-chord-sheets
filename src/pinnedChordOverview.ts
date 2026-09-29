import {chordSequenceString, Instrument, uniqueChordTokens} from "./chordsUtils";
import {makeChordOverview} from "./chordDiagrams";
import {ChordToken} from "./sheet-parsing/tokens";

export interface PinnedOverviewBounds {
	top: number;
	left: number;
	width: number;
}

/** Keep a panel inside its pane while the current chord block crosses the top.
 * @example pinnedOverviewBounds(0, 600, 20, 400, -100, 900)
 */
export function pinnedOverviewBounds(
	paneTop: number,
	paneBottom: number,
	left: number,
	width: number,
	blockTop: number,
	blockBottom: number
): PinnedOverviewBounds | null {
	if (width <= 0 || paneBottom <= paneTop || blockTop >= paneTop || blockBottom <= paneTop) {
		return null;
	}
	return {top: paneTop, left, width};
}

export class PinnedChordOverview {
	private readonly panel: HTMLDivElement;
	private sequence = "";

	constructor(private readonly ownerDocument: Document) {
		this.panel = ownerDocument.createElement("div");
		this.panel.className = "chord-sheet-chord-overview-container chord-sheet-pinned-overview";
		this.panel.hidden = true;
		ownerDocument.body.appendChild(this.panel);
	}

	/** Refresh diagrams only when the block or its presentation changes.
	 * @example overview.setChords("guitar", tokens, 100)
	 */
	setChords(instrument: Instrument, tokens: ChordToken[], width: number): void {
		const uniqueTokens = uniqueChordTokens(tokens);
		const sequence = `${instrument}:${width}:${chordSequenceString(uniqueTokens)}`;
		if (sequence === this.sequence) return;
		this.sequence = sequence;
		const overview = this.ownerDocument.createElement("div");
		overview.className = "chord-sheet-chord-overview chord-sheet-preview-mode";
		makeChordOverview(instrument, overview, uniqueTokens, width);
		this.panel.replaceChildren(overview);
	}

	/** Show or hide the panel within the measured pane bounds.
	 * @example overview.place(null)
	 */
	place(bounds: PinnedOverviewBounds | null): void {
		this.panel.hidden = bounds === null;
		if (!bounds) return;
		const {top, left, width} = bounds;
		Object.assign(this.panel.style, {
			top: `${top}px`,
			left: `${left}px`,
			width: `${width}px`
		});
	}

	/** Remove the overlay when its view is unloaded.
	 * @example overview.destroy()
	 */
	destroy(): void {
		this.panel.remove();
	}
}
