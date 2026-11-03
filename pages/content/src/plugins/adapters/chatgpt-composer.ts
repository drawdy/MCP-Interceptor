export const CHATGPT_COMPOSER_SELECTOR =
  '#prompt-textarea, .ProseMirror[contenteditable="true"], div[contenteditable="true"][data-id*="prompt"]';

export function isVisibleChatGPTElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    element.isConnected &&
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    !element.closest('[inert], [aria-hidden="true"]')
  );
}

/** ChatGPT keeps the home composer mounted but hidden after opening a thread. */
export function findChatGPTComposer(root: ParentNode = document): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>(CHATGPT_COMPOSER_SELECTOR)).find(element =>
      isVisibleChatGPTElement(element),
    ) ?? null
  );
}

export function findChatGPTFileInput(composer: HTMLElement): HTMLInputElement | null {
  return composer.closest('form')?.querySelector<HTMLInputElement>('input[type="file"][multiple]') ?? null;
}

export function findChatGPTButtonInsertionPoint(
  composer: HTMLElement | null = findChatGPTComposer(),
): { container: Element; insertAfter: Element | null } | null {
  const form = composer?.closest('form');
  if (!form) return null;
  const plusButton = form.querySelector<HTMLElement>(
    'button[data-composer-navigation-target="add-context"], [data-testid="composer-plus-btn"], button[aria-label="Add files and more"], button[aria-label="添加文件等内容"]',
  );
  if (plusButton?.parentElement && isVisibleChatGPTElement(plusButton)) {
    return { container: plusButton.parentElement, insertAfter: plusButton };
  }
  const leadingArea = form.querySelector<HTMLElement>(
    '[grid-area="leading"], [data-testid="composer-footer-actions"], .composer-footer-actions',
  );
  return leadingArea && isVisibleChatGPTElement(leadingArea)
    ? { container: leadingArea, insertAfter: leadingArea.lastElementChild }
    : null;
}

/** Confirm this filename in this composer, never another image or a hidden form. */
export function findChatGPTFilePreviews(composer: HTMLElement, fileName: string): HTMLElement[] {
  const form = composer.closest('form');
  if (!form) return [];
  return Array.from(
    form.querySelectorAll<HTMLElement>(
      'img, .composer-attachment-surface, .file-preview, .attachment-preview, [data-testid="file-attachment"]',
    ),
  ).filter(
    element =>
      isVisibleChatGPTElement(element) &&
      (element.getAttribute('alt') === fileName ||
        element.getAttribute('aria-label') === fileName ||
        element.textContent?.includes(fileName)),
  );
}
