import {MarkdownRenderChild} from "obsidian";
import {Instrument, uniqueChordTokens} from "./chordsUtils";
import tippy from "tippy.js/headless";
import {makeChordDiagram, makeChordOverview} from "./chordDiagrams";
import {ChordSheetsSettings} from "./chordSheetsSettings";

import {ChordToken, isChordToken, isHeaderToken, isMarkerToken, isRhythmToken} from "./sheet-parsing/tokens";
import {tokenizeLine} from "./sheet-parsing/tokenizeLine";

type FormattingState = {
	marker: "*" | "**" | "***" | "_" | "__" | "___" | null;
	container: HTMLElement | null;
	element: HTMLElement | null;
};

function getFormattedContainer(container: HTMLElement, state: FormattingState): HTMLElement {
	if (!state.marker) {
		return container;
	}

	if (state.container !== container) {
		state.container = container;
		const formattingElement = container.createEl(state.marker.length > 1 ? "strong" : "em");
		state.element = state.marker.length === 3 ? formattingElement.createEl("em") : formattingElement;
	}

	return state.element ?? container;
}

function appendFormattedText(
	container: HTMLElement,
	value: string,
	state: FormattingState,
	enabledMarkers: ReadonlySet<Exclude<FormattingState["marker"], null>>
): void {
	let cursor = 0;

	while (cursor < value.length) {
		const marker = value.slice(cursor).match(/^(\*\*\*|___|\*\*|__|\*|_)/)?.[1];
		if (!marker) {
			const nextMarker = value.slice(cursor).search(/[ *_]/);
			const end = nextMarker === -1 ? value.length : cursor + nextMarker;
			const target = getFormattedContainer(container, state);
			target?.append(value.slice(cursor, end));
			if (end === cursor) {
				target?.append(value[cursor] === " " ? "\u00a0" : value[cursor]);
				cursor++;
			} else {
				cursor = end;
			}
			continue;
		}
		if (!enabledMarkers.has(marker as Exclude<FormattingState["marker"], null>)) {
			getFormattedContainer(container, state).append(marker);
			cursor += marker.length;
			continue;
		}

		if (state.marker === marker) {
			state.marker = null;
			state.container = null;
			state.element = null;
		} else if (!state.marker) {
			state.marker = marker as FormattingState["marker"];
			state.container = container;
			const formattingElement = container.createEl(marker.length > 1 ? "strong" : "em");
			state.element = marker.length === 3 ? formattingElement.createEl("em") : formattingElement;
		} else {
			const target = state.container === container ? state.element : container;
			target?.append(marker);
		}
		cursor += marker.length;
	}
}

export class ChordBlockPostProcessorView extends MarkdownRenderChild {
	source: string;

	constructor(
		containerEl: HTMLElement,
		private instrument: Instrument,
		private settings: ChordSheetsSettings
	) {
		super(containerEl);
	}

	async onload() {

		const codeEl = this.containerEl.getElementsByTagName("code").item(0);
		if (codeEl) {
			this.source = codeEl.innerText;
		}

		this.render();
	}

	private render() {
		const {
			chordLineMarker,
			textLineMarker,
			showChordDiagramsOnHover,
			showChordOverview,
			diagramWidth,
			highlightChords,
			highlightSectionHeaders,
			highlightRhythmMarkers,
			showLineMarkersInReadingMode
		} = this.settings;

		if (this.containerEl.children.length > 0) {
			this.containerEl.empty();
		}

		const codeEl = this.containerEl.createEl("code", {cls: "chord-sheet-chord-block-preview"});

		const chordTokens: ChordToken[] = [];
		const formattingState: FormattingState = {marker: null, container: null, element: null};
		const formattingMarkers = ["*", "**", "***", "_", "__", "___"] as const;
		const enabledMarkers = new Set(
			formattingMarkers.filter((marker) => this.source.split(marker).length - 1 >= 2)
		);
		const lines = this.source.split("\n");
		let currentIndex = 0;
		for (const line of lines) {
			const tokenizedLine = tokenizeLine(line, currentIndex, chordLineMarker, textLineMarker);

			const lineDiv = codeEl.createDiv({
				cls: "chord-sheet-chord-line"
			});

			for (let i = 0; i < tokenizedLine.tokens.length; i++) {
				const token = tokenizedLine.tokens[i];

				if (isChordToken(token)) {
					chordTokens.push(token);

					let nextToken = tokenizedLine.tokens[i + 1];
					const isTokenPair =
						this.settings.displayInlineChordsOverLyrics &&
						token.inlineChord && (
							!nextToken || nextToken?.type === "word" || nextToken?.type === "whitespace" ||
							isChordToken(nextToken)
						);


					const chordLineContainer = getFormattedContainer(lineDiv, formattingState);
					const pairSpan = isTokenPair ? chordLineContainer.createSpan({
						cls: "chord-sheet-chord-text-pair"
					}) : null;

					const chordSpan = (pairSpan ?? chordLineContainer).createSpan({
						cls: "chord-sheet-chord",
					});


					if (token.inlineChord) {
						if (isTokenPair) {
							lineDiv.addClass("chord-sheet-inline-over-lyrics");
						}
						chordSpan.createSpan({
							cls: `chord-sheet-inline-chord-bracket`,
							text: token.inlineChord.openingBracket.value
						});
					}

					chordSpan.createSpan({
						cls: `chord-sheet-chord-name${highlightChords ? " chord-sheet-chord-highlight" : ""}`,
						text: token.chordSymbol.value
					});

					if (token.userDefinedChord) {
						const userDefinedChord = token.userDefinedChord;

						chordSpan.createSpan({
							cls: 'chord-sheet-user-defined-chord-bracket',
							text: userDefinedChord.openingBracket.value
						});
						userDefinedChord.position && chordSpan.createSpan({
							cls: 'chord-sheet-user-defined-chord-position',
							text: userDefinedChord.position.value
						});
						userDefinedChord.positionSeparator && chordSpan.createSpan({
							cls: 'chord-sheet-user-defined-chord-position-separator',
							text: userDefinedChord.positionSeparator.value
						});
						chordSpan.createSpan({
							cls: 'chord-sheet-user-defined-chord-frets',
							text: userDefinedChord.frets.value
						});
						chordSpan.createSpan({
							cls: 'chord-sheet-user-defined-chord-bracket',
							text: userDefinedChord.closingBracket.value
						});

					}

					if (token.inlineChord) {
						if (token.inlineChord.auxText) {
							chordSpan.createSpan({
								cls: `chord-sheet-inline-chord-aux-text`,
								text: token.inlineChord.auxText.value
							});
						}
						chordSpan.createSpan({
							cls: `chord-sheet-inline-chord-bracket`,
							text: token.inlineChord.closingBracket.value
						});

						const trailingSpan = pairSpan?.createSpan({
							cls: `chord-sheet-inline-chord-trailing-text`
						});

						if (trailingSpan) {
							// fast-forward until the next chord token
							while (nextToken && !isChordToken(nextToken)) {
								if (isMarkerToken(nextToken)) {
									if (showLineMarkersInReadingMode) {
										trailingSpan.createSpan({
											cls: `chord-sheet-line-marker`,
											text: nextToken.value
										});
									}
								} else {
										const textSpan = trailingSpan.createSpan({
											cls: `chord-sheet-${nextToken.type}`
										});
										appendFormattedText(textSpan, nextToken.value, formattingState, enabledMarkers);
								}
								i++;
								nextToken = tokenizedLine.tokens[i + 1];
							}
						}
					}


					if (showChordDiagramsOnHover === "always" || showChordDiagramsOnHover === "preview") {
						this.attachChordDiagram(token, chordSpan);
					}
				} else if (highlightRhythmMarkers && isRhythmToken(token)) {
					lineDiv.createSpan({
						cls: `chord-sheet-rhythm-marker`,
						text: token.value
					});
				} else if (isMarkerToken(token)) {
					if (showLineMarkersInReadingMode) {
						lineDiv.createSpan({
							cls: `chord-sheet-line-marker`,
							text: token.value
						});
					}
				} else if (highlightSectionHeaders && isHeaderToken(token)) {
					lineDiv.addClass("chord-sheet-section-header");
					const headerSpan = lineDiv.createSpan({
						cls: "chord-sheet-section-header-content",
					});
					headerSpan.createSpan({
						cls: `chord-sheet-section-header-bracket`,
						text: token.openingBracket.value
					});
					headerSpan.createSpan({
						cls: `chord-sheet-section-header-name cm-strong`,
                        text: token.headerName.value
					});
					headerSpan.createSpan({
						cls: `chord-sheet-section-header-bracket`,
						text: token.closingBracket.value
					});
				} else {
					appendFormattedText(lineDiv, token.value, formattingState, enabledMarkers);
				}
			}

			currentIndex = currentIndex + line.length;
		}

		if (showChordOverview === "always" || showChordOverview === "preview") {
			const uniqueTokens = uniqueChordTokens(chordTokens);
			const overviewContainerEl = createDiv({cls: "chord-sheet-chord-overview-container"});
			const overviewEl = overviewContainerEl.createDiv({cls: "chord-sheet-chord-overview"});
			makeChordOverview(this.instrument, overviewEl, uniqueTokens, diagramWidth);
			this.containerEl.prepend(overviewContainerEl);
		}
	}

	private attachChordDiagram(token: ChordToken, tokenEl: HTMLElement) {
		const popper = document.createElement("div");
		const { instrument, settings } = this;
		const { diagramWidth } = settings;

		popper.classList.add("chord-sheet-chord-popup");

		// noinspection JSUnusedGlobalSymbols
		tippy(tokenEl, {
			interactive: true,
			render() {
				return {popper};
			},
			onShow(instance) {
				instance.popper.appendChild(makeChordDiagram(instrument, token, diagramWidth));
			},
			onHidden(instance) {
				instance.popper.empty();
			}
		});

	}

}
