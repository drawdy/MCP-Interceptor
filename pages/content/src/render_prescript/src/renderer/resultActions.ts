/** Serialize manual result actions, including programmatic clicks. */
export function createResultActionLock() {
  let busy = false;
  return async (action: () => Promise<void>): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      await action();
    } finally {
      busy = false;
    }
  };
}

interface ResultAdapter {
  insertText?: (text: string) => Promise<boolean>;
  insertTextIntoInput?: (text: string) => Promise<boolean | void>;
}

/** Legacy insertion may return void; an explicit false always means failure. */
export async function insertResultText(adapter: ResultAdapter, text: string): Promise<boolean> {
  if (typeof adapter.insertText === 'function') {
    try {
      if ((await adapter.insertText(text)) === true) return true;
    } catch {
      // Older adapters may expose the modern method without implementing it.
    }
  }
  if (typeof adapter.insertTextIntoInput === 'function') {
    return (await adapter.insertTextIntoInput(text)) !== false;
  }
  return false;
}

/** Keep confirmed attachments across retries. */
export async function attachPendingResultImages(
  files: readonly File[],
  attached: Set<File>,
  attach: (file: File) => Promise<boolean>,
): Promise<number> {
  let failures = 0;
  for (const file of files) {
    if (attached.has(file)) continue;
    try {
      if ((await attach(file)) === true) attached.add(file);
      else failures += 1;
    } catch {
      failures += 1;
    }
  }
  return failures;
}
