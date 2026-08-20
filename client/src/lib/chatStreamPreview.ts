import { createChatStreamGuard } from "./chatStreamGuard";

export type ChatStreamPreview = {
  pendingPrompt: string;
  streamedResponse: string;
};

export function beginChatStreamPreview(prompt: string): ChatStreamPreview {
  return { pendingPrompt: prompt, streamedResponse: "" };
}

export function appendChatStreamToken(preview: ChatStreamPreview, token: string): ChatStreamPreview {
  return { ...preview, streamedResponse: preview.streamedResponse + token };
}

export function clearPersistedChatStreamPreview(): ChatStreamPreview {
  return { pendingPrompt: "", streamedResponse: "" };
}

export function createChatSubmissionLifecycle() {
  const guard = createChatStreamGuard();
  let preview = clearPersistedChatStreamPreview();

  return {
    tryStart(prompt: string) {
      if (!guard.tryAcquire()) return null;
      preview = beginChatStreamPreview(prompt);
      return preview;
    },
    append(token: string) {
      preview = appendChatStreamToken(preview, token);
      return preview;
    },
    finishAfterPersistedRefresh() {
      preview = clearPersistedChatStreamPreview();
      guard.release();
      return preview;
    },
    release() {
      guard.release();
    },
    isActive() {
      return guard.isLocked();
    },
  };
}
