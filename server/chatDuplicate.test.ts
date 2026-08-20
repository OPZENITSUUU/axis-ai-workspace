import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createChatStreamGuard } from "../client/src/lib/chatStreamGuard";
import { createChatDataReloadActions } from "../client/src/lib/chatDataReloadActions";
import {
  appendChatStreamToken,
  beginChatStreamPreview,
  clearPersistedChatStreamPreview,
  createChatSubmissionLifecycle,
} from "../client/src/lib/chatStreamPreview";

describe("AXIS chat duplicate safeguards", () => {
  it("allows only one rapid submit until the active stream is released", () => {
    const guard = createChatStreamGuard();

    expect(guard.tryAcquire()).toBe(true);
    expect(guard.tryAcquire()).toBe(false);
    expect(guard.isLocked()).toBe(true);
    guard.release();
    expect(guard.isLocked()).toBe(false);
    expect(guard.tryAcquire()).toBe(true);
  });

  it("clears temporary user and assistant previews once persisted messages replace the stream", () => {
    const started = beginChatStreamPreview("Explain this topic");
    const streamed = appendChatStreamToken(started, "Here is the answer.");
    const cleared = clearPersistedChatStreamPreview();

    expect(streamed).toEqual({
      pendingPrompt: "Explain this topic",
      streamedResponse: "Here is the answer.",
    });
    expect(cleared).toEqual({ pendingPrompt: "", streamedResponse: "" });
  });

  it("reconciles one submitted stream with persisted messages and rejects a second rapid lifecycle start", () => {
    const lifecycle = createChatSubmissionLifecycle();
    const started = lifecycle.tryStart("Private prompt");

    expect(started).toEqual({ pendingPrompt: "Private prompt", streamedResponse: "" });
    expect(lifecycle.tryStart("Duplicate prompt")).toBeNull();
    expect(lifecycle.append("Private response")).toEqual({
      pendingPrompt: "Private prompt",
      streamedResponse: "Private response",
    });

    const persistedMessages = [
      { id: 1, role: "user", content: "Private prompt" },
      { id: 2, role: "assistant", content: "Private response" },
    ];
    const afterRefresh = lifecycle.finishAfterPersistedRefresh();

    expect(persistedMessages).toHaveLength(2);
    expect(afterRefresh).toEqual({ pendingPrompt: "", streamedResponse: "" });
    expect(lifecycle.isActive()).toBe(false);
  });

  it("retries only conversation data reloads and has no chat-submission dependency", () => {
    let conversationReloads = 0;
    let conversationListReloads = 0;
    const actions = createChatDataReloadActions({
      reloadConversation: () => { conversationReloads += 1; },
      reloadConversationList: () => { conversationListReloads += 1; },
    });

    actions.retryConversation();
    actions.retryConversationList();

    expect(conversationReloads).toBe(1);
    expect(conversationListReloads).toBe(1);
  });

  it("locks a send before React state settles and clears temporary stream previews after persistence refreshes", async () => {
    const home = await readFile(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(home).toContain("const streamLifecycleRef = useRef(createChatSubmissionLifecycle());");
    expect(home).toContain("if (!content || isStreaming || streamLifecycleRef.current.isActive()) return;");
    expect(home).toContain("const preview = streamLifecycleRef.current.tryStart(content);");
    expect(home).toContain("streamLifecycleRef.current.release();");
    expect(home).toContain("utils.conversations.get.invalidate({ conversationId })");

    const successfulRefresh = home.slice(
      home.indexOf("if (conversationId) {"),
      home.indexOf("} catch (error)", home.indexOf("if (conversationId) {")),
    );
    expect(successfulRefresh).toContain("const persistedPreview = streamLifecycleRef.current.finishAfterPersistedRefresh();");
    expect(successfulRefresh).toContain("setPendingPrompt(persistedPreview.pendingPrompt);");
    expect(successfulRefresh).toContain("setStreamedResponse(persistedPreview.streamedResponse);");

    expect(home).toContain("const chatDataReloadActions = createChatDataReloadActions({");
    expect(home).toContain("onClick={chatDataReloadActions.retryConversationList}");
    expect(home).toContain("<QueryError onRetry={chatDataReloadActions.retryConversation} />");
  });
});
