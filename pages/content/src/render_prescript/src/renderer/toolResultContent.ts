export const MAX_MCP_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MCP_IMAGE_COUNT = 8;
export const MAX_MCP_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

export interface ToolResultTextSegment {
  kind: 'text';
  text: string;
}

export interface ToolResultImageSegment {
  kind: 'image';
  file: File;
  alt: string;
}

export interface ToolResultNoticeSegment {
  kind: 'notice';
  text: string;
}

export type ToolResultSegment = ToolResultTextSegment | ToolResultImageSegment | ToolResultNoticeSegment;

export interface NormalizedToolResult {
  segments: ToolResultSegment[];
  images: File[];
  textForInsertion: string;
  requiresExplicitAction: boolean;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'tool';
}

function decodeImageFile(
  dataValue: unknown,
  declaredMimeType: unknown,
  functionName: string,
  callId: string,
  imageIndex: number,
): File {
  if (typeof dataValue !== 'string' || dataValue.length === 0) {
    throw new Error('image data is empty');
  }

  let data = dataValue;
  let mimeType = typeof declaredMimeType === 'string' ? declaredMimeType.trim().toLowerCase() : '';
  const dataUriMatch = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(data);

  if (dataUriMatch) {
    const dataUriMimeType = dataUriMatch[1].toLowerCase();
    if (mimeType && mimeType !== dataUriMimeType) {
      throw new Error('image MIME type does not match its data URI');
    }
    mimeType = mimeType || dataUriMimeType;
    data = dataUriMatch[2];
  } else if (data.startsWith('data:')) {
    throw new Error('image data URI is malformed');
  }

  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) {
    throw new Error(`unsupported image MIME type: ${mimeType || 'missing'}`);
  }

  if (data.length > MAX_MCP_IMAGE_BYTES * 2) {
    throw new Error('image data exceeds the per-image size limit');
  }

  const base64 = data.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('image data is not valid Base64');
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if ((padding > 0 && base64.length % 4 !== 0) || base64.length % 4 === 1) {
    throw new Error('image Base64 length is invalid');
  }

  const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const estimatedSize =
    Math.floor((paddedBase64.length * 3) / 4) - (paddedBase64.endsWith('==') ? 2 : paddedBase64.endsWith('=') ? 1 : 0);
  if (estimatedSize <= 0) {
    throw new Error('image data is empty');
  }
  if (estimatedSize > MAX_MCP_IMAGE_BYTES) {
    throw new Error(`image exceeds the ${MAX_MCP_IMAGE_BYTES / (1024 * 1024)} MiB per-image limit`);
  }

  let binary: string;
  try {
    binary = atob(paddedBase64);
  } catch {
    throw new Error('image data could not be decoded');
  }

  if (binary.length > MAX_MCP_IMAGE_BYTES) {
    throw new Error(`image exceeds the ${MAX_MCP_IMAGE_BYTES / (1024 * 1024)} MiB per-image limit`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const safeFunctionName = safeFilenamePart(functionName);
  const safeCallId = safeFilenamePart(callId);
  const fileName = `mcp-${safeFunctionName}-${safeCallId}-image-${String(imageIndex).padStart(2, '0')}.${extension}`;
  return new File([bytes], fileName, { type: mimeType });
}

function serializeFallback(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function appendImageBlock(
  segments: ToolResultSegment[],
  images: File[],
  block: Record<string, unknown>,
  functionName: string,
  callId: string,
  totalImageBytes: { value: number },
): void {
  if (images.length >= MAX_MCP_IMAGE_COUNT) {
    segments.push({
      kind: 'notice',
      text: `Image omitted: this result exceeds the ${MAX_MCP_IMAGE_COUNT}-image limit.`,
    });
    return;
  }

  try {
    const file = decodeImageFile(block.data, block.mimeType, functionName, callId, images.length + 1);

    if (totalImageBytes.value + file.size > MAX_MCP_TOTAL_IMAGE_BYTES) {
      segments.push({
        kind: 'notice',
        text: `Image omitted: this result exceeds the ${MAX_MCP_TOTAL_IMAGE_BYTES / (1024 * 1024)} MiB total image limit.`,
      });
      return;
    }

    totalImageBytes.value += file.size;
    images.push(file);
    segments.push({
      kind: 'image',
      file,
      alt: typeof block.alt === 'string' ? block.alt : file.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'image could not be processed';
    segments.push({ kind: 'notice', text: `Image unavailable: ${message}.` });
  }
}

function appendResourceBlock(
  segments: ToolResultSegment[],
  images: File[],
  block: Record<string, unknown>,
  functionName: string,
  callId: string,
  totalImageBytes: { value: number },
): void {
  const resource = block.resource;
  if (!resource || typeof resource !== 'object') {
    segments.push({ kind: 'notice', text: 'Embedded MCP resource is unavailable.' });
    return;
  }

  const embedded = resource as Record<string, unknown>;
  if (typeof embedded.text === 'string') {
    segments.push({ kind: 'text', text: embedded.text });
    return;
  }

  if (
    typeof embedded.blob === 'string' &&
    typeof embedded.mimeType === 'string' &&
    embedded.mimeType.toLowerCase().startsWith('image/')
  ) {
    appendImageBlock(
      segments,
      images,
      { data: embedded.blob, mimeType: embedded.mimeType },
      functionName,
      callId,
      totalImageBytes,
    );
    return;
  }

  const label = typeof embedded.uri === 'string' ? embedded.uri : 'resource';
  segments.push({
    kind: 'notice',
    text: `Embedded resource not previewed: ${label}.`,
  });
}

export function buildToolResultInsertionText(
  segments: ToolResultSegment[],
  attachedFiles: ReadonlySet<File> = new Set<File>(),
): string {
  return segments
    .map(segment => {
      if (segment.kind === 'text') return segment.text;
      if (segment.kind === 'notice') return segment.text;
      return attachedFiles.has(segment.file)
        ? `[Image attached: ${segment.file.name}]`
        : `[Image not attached: ${segment.file.name}]`;
    })
    .join('\n');
}

export function normalizeToolResultContent(
  result: unknown,
  functionName: string,
  callId: string,
): NormalizedToolResult {
  const segments: ToolResultSegment[] = [];
  const images: File[] = [];
  const totalImageBytes = { value: 0 };
  let requiresExplicitAction = false;

  if (result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).content)) {
    const content = (result as Record<string, unknown>).content as unknown[];

    for (const rawBlock of content) {
      if (!rawBlock || typeof rawBlock !== 'object') {
        segments.push({ kind: 'notice', text: 'Unsupported MCP content block.' });
        continue;
      }

      const block = rawBlock as Record<string, unknown>;
      switch (block.type) {
        case 'text':
          if (typeof block.text === 'string') {
            segments.push({ kind: 'text', text: block.text });
          }
          break;
        case 'image':
          requiresExplicitAction = true;
          appendImageBlock(segments, images, block, functionName, callId, totalImageBytes);
          break;
        case 'resource':
          if (
            typeof (block.resource as Record<string, unknown> | undefined)?.mimeType === 'string' &&
            String((block.resource as Record<string, unknown>).mimeType)
              .toLowerCase()
              .startsWith('image/')
          ) {
            requiresExplicitAction = true;
          }
          appendResourceBlock(segments, images, block, functionName, callId, totalImageBytes);
          break;
        case 'resource_link': {
          const title = typeof block.name === 'string' ? block.name : 'Resource link';
          const uri = typeof block.uri === 'string' ? block.uri : '';
          segments.push({ kind: 'notice', text: uri ? `${title}: ${uri}` : title });
          break;
        }
        case 'audio': {
          const mimeType = typeof block.mimeType === 'string' ? block.mimeType : 'unknown MIME type';
          segments.push({
            kind: 'notice',
            text: `Audio content returned (${mimeType}); audio preview is not supported yet.`,
          });
          break;
        }
        default:
          segments.push({
            kind: 'notice',
            text: `Unsupported MCP content block: ${typeof block.type === 'string' ? block.type : 'unknown'}.`,
          });
      }
    }
  }

  if (segments.length === 0) {
    const structuredContent =
      result && typeof result === 'object' ? (result as Record<string, unknown>).structuredContent : undefined;
    segments.push({
      kind: 'text',
      text: serializeFallback(structuredContent !== undefined ? structuredContent : result),
    });
  }

  return {
    segments,
    images,
    requiresExplicitAction,
    textForInsertion: buildToolResultInsertionText(segments),
  };
}
