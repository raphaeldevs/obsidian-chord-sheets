import {ChordSheetsSettings} from "../chordSheetsSettings";
import {ViewPlugin} from "@codemirror/view";
import {chordSheetEditorPlugin, ChordSheetsViewPlugin} from "./chordSheetsViewPlugin";
import {
	chordBlocksStateField,
	chordSheetsConfig,
	chordSheetsConfigFacet
} from "./chordBlocksStateField";
import {pinnedChordOverviewPlugin} from "./pinnedChordOverviewPlugin";
import {debugExtensions} from "./debugUtils";

export const chordSheetsEditorExtension = (settings: ChordSheetsSettings, viewPlugin?: ViewPlugin<ChordSheetsViewPlugin>) => [
	chordSheetsConfig.of(chordSheetsConfigFacet.of({...settings})),
	chordBlocksStateField,
	pinnedChordOverviewPlugin,
	viewPlugin ?? chordSheetEditorPlugin(),
	settings.debug ? debugExtensions : []
];
