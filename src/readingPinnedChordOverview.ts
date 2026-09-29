import type {MarkdownRenderChild} from "obsidian";

/** Keep the original wrapped overview visible without duplicating its diagrams.
 * @example attachReadingPinnedOverview(child, overviewElement)
 */
export function attachReadingPinnedOverview(child: MarkdownRenderChild, sourceOverview: HTMLElement): void {
	child.containerEl.classList.add("chord-sheet-sticky-block");
	sourceOverview.classList.add("chord-sheet-sticky-overview");
	observeReadingPaneInset(child, sourceOverview);
	child.register(() => {
		child.containerEl.classList.remove("chord-sheet-sticky-block");
		sourceOverview.classList.remove("chord-sheet-sticky-overview");
		sourceOverview.style.removeProperty("--chord-sheet-sticky-inset");
	});
}

function updateReadingPaneInset(sourceOverview: HTMLElement): boolean {
	const pane = sourceOverview.closest<HTMLElement>(".markdown-preview-view");
	const ownerWindow = sourceOverview.ownerDocument.defaultView;
	if (!pane || !ownerWindow) return false;
	const paddingTop = ownerWindow.getComputedStyle(pane).paddingTop;
	sourceOverview.style.setProperty("--chord-sheet-sticky-inset", paddingTop);
	return true;
}

function observeReadingPaneInset(child: MarkdownRenderChild, sourceOverview: HTMLElement): void {
	const ownerWindow = sourceOverview.ownerDocument.defaultView;
	if (!ownerWindow) return;
	const refresh = (): boolean => updateReadingPaneInset(sourceOverview);
	child.registerDomEvent(ownerWindow, "resize", refresh);
	if (refresh()) return;
	// Reading post-processors can run before Obsidian mounts their block into its pane.
	const observer = new ownerWindow.MutationObserver(() => {
		if (refresh()) observer.disconnect();
	});
	observer.observe(sourceOverview.ownerDocument.body, {childList: true, subtree: true});
	child.register(() => observer.disconnect());
}
