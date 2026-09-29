import {EditorView, ViewPlugin, ViewUpdate} from "@codemirror/view";
import {pinnedOverviewBounds, PinnedChordOverview, PinnedOverviewBounds} from "../pinnedChordOverview";
import {ChordToken} from "../sheet-parsing/tokens";
import {chordBlocksStateField, chordSheetsConfigFacet} from "./chordBlocksStateField";
import {Instrument} from "../chordsUtils";

interface PinnedEditorMeasurement {
	bounds: PinnedOverviewBounds;
	instrument: Instrument;
	tokens: ChordToken[];
	width: number;
}

class PinnedChordOverviewPlugin {
	private readonly overview: PinnedChordOverview;
	private destroyed = false;
	private readonly schedule = (): void => {
		this.view.requestMeasure({
			key: this,
			read: () => this.measure(),
			write: (measurement) => this.render(measurement)
		});
	};

	constructor(private readonly view: EditorView) {
		this.overview = new PinnedChordOverview(view.dom.ownerDocument);
		view.scrollDOM.addEventListener("scroll", this.schedule);
		view.dom.ownerDocument.defaultView?.addEventListener("resize", this.schedule);
		this.schedule();
	}

	/** Re-measure after edits, settings changes or pane layout changes.
	 * @example plugin.update(viewUpdate)
	 */
	update(_update: ViewUpdate): void {
		this.schedule();
	}

	private measure(): PinnedEditorMeasurement | null {
		if (this.destroyed || !this.view.inView) return null;
		const settings = this.view.state.facet(chordSheetsConfigFacet);
		if (!settings.pinChordOverview || !["always", "edit"].includes(settings.showChordOverview)) return null;
		const pane = this.view.scrollDOM.getBoundingClientRect();
		const position = this.view.lineBlockAtHeight(pane.top - this.view.documentTop).from;
		const chordState = this.view.state.field(chordBlocksStateField);
		const block = chordState.ranges.iter(position);
		if (!block.value || block.from > position || block.to <= position) return null;
		const bounds = this.measureBlockBounds(block.from, block.to);
		if (!bounds) return null;
		return this.collectMeasurement(block.from, block.to, block.value.instrument, settings.diagramWidth, bounds);
	}

	private measureBlockBounds(from: number, to: number): PinnedOverviewBounds | null {
		const pane = this.view.scrollDOM.getBoundingClientRect();
		const content = this.view.contentDOM.getBoundingClientRect();
		const blockTop = this.view.documentTop + this.view.lineBlockAt(from).top;
		const blockBottom = this.view.documentTop + this.view.lineBlockAt(to - 1).bottom;
		const left = Math.max(pane.left, content.left);
		return pinnedOverviewBounds(
			pane.top,
			pane.bottom,
			left,
			Math.min(pane.right, content.right) - left,
			blockTop,
			blockBottom
		);
	}

	private collectMeasurement(
		from: number,
		to: number,
		instrument: Instrument,
		width: number,
		bounds: PinnedOverviewBounds
	): PinnedEditorMeasurement {
		const tokens: ChordToken[] = [];
		this.view.state.field(chordBlocksStateField).chordDecos.between(from, to, (_from, _to, decoration) => {
			if (decoration.spec.type === "chord") tokens.push(decoration.spec.token as ChordToken);
		});
		return {bounds, tokens, instrument, width};
	}

	private render(measurement: PinnedEditorMeasurement | null): void {
		if (this.destroyed) return;
		if (measurement) this.overview.setChords(measurement.instrument, measurement.tokens, measurement.width);
		this.overview.place(measurement?.bounds ?? null);
	}

	/** Release pane listeners and the overlay on editor teardown.
	 * @example plugin.destroy()
	 */
	destroy(): void {
		this.destroyed = true;
		this.view.scrollDOM.removeEventListener("scroll", this.schedule);
		this.view.dom.ownerDocument.defaultView?.removeEventListener("resize", this.schedule);
		this.overview.destroy();
	}
}

export const pinnedChordOverviewPlugin = ViewPlugin.fromClass(PinnedChordOverviewPlugin);
