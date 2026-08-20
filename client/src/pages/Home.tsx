import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { gatewayUnavailableGuidance } from "@shared/providerGuidance";
import { Streamdown } from "streamdown";
import {
  ArrowUp,
  Bot,
  Check,
  Command,
  Download,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  Paperclip,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ChatEntry = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

type PendingAttachment = {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

const suggestedPrompts = [
  "Mujhe ek difficult topic simple Hinglish mein samjhao",
  "Turn these notes into a focused study plan",
  "Review this idea and point out the weak assumptions",
];

const supportedFileTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getAuthenticatedHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    const pair = raw?.split(";").find(value => value.trim().startsWith("app_session_id="));
    const token = pair?.trim().slice("app_session_id=".length);
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Cookie-based authentication remains available when session storage is unavailable.
  }
  return headers;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

function formatRelativeDate(value: Date | string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) return "This week";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { canInstall, install, isInstalled } = useInstallPrompt();
  const utils = trpc.useUtils();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [streamedResponse, setStreamedResponse] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"saved" | "draft">("saved");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = trpc.conversations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const providerStatusQuery = trpc.providers.status.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const filesQuery = trpc.files.list.useQuery(undefined, { enabled: isAuthenticated });
  const settingsQuery = trpc.workspace.settings.useQuery(undefined, { enabled: isAuthenticated });
  const exportWorkspaceQuery = trpc.workspace.export.useQuery(undefined, { enabled: false });
  const conversationQuery = trpc.conversations.get.useQuery(
    { conversationId: activeConversationId ?? 0 },
    { enabled: isAuthenticated && activeConversationId !== null },
  );
  const createConversation = trpc.conversations.create.useMutation();
  const createProject = trpc.projects.create.useMutation();
  const updateProject = trpc.projects.update.useMutation();
  const updateSettings = trpc.workspace.updateSettings.useMutation();
  const deleteWorkspaceData = trpc.workspace.deleteData.useMutation();
  const selectConversationProvider = trpc.conversations.selectProvider.useMutation();

  useEffect(() => {
    if (!activeConversationId && conversationsQuery.data?.[0]) {
      setActiveConversationId(conversationsQuery.data[0].id);
    }
  }, [activeConversationId, conversationsQuery.data]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth", block: "end" });
  }, [conversationQuery.data?.messages, pendingPrompt, streamedResponse, isStreaming]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  useEffect(() => {
    if (!user) return;
    const key = `axis:draft:${user.id}:${activeConversationId ?? "new"}`;
    try {
      setDraft(localStorage.getItem(key) || "");
    } catch {
      setDraft("");
    }
  }, [user?.id, activeConversationId]);

  useEffect(() => {
    if (!user) return;
    const key = `axis:draft:${user.id}:${activeConversationId ?? "new"}`;
    const timer = window.setTimeout(() => {
      try {
        if (draft.trim()) localStorage.setItem(key, draft);
        else localStorage.removeItem(key);
        setDraftStatus("saved");
      } catch {
        // Local drafts are a convenience only; the chat remains usable if storage is unavailable.
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [draft, user?.id, activeConversationId]);

  const ensureConversation = async () => {
    if (activeConversationId) return activeConversationId;
    const conversation = await createConversation.mutateAsync({});
    setActiveConversationId(conversation.id);
    await utils.conversations.list.invalidate();
    return conversation.id;
  };

  const chooseConversation = (id: number) => {
    setActiveConversationId(id);
    setAttachments([]);
    setSidebarOpen(false);
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setAttachments([]);
    setDraft("");
    setSidebarOpen(false);
    setMobileSheetOpen(false);
  };

  const startProjectConversation = async (projectId: number) => {
    try {
      const conversation = await createConversation.mutateAsync({ projectId });
      setActiveConversationId(conversation.id);
      await utils.conversations.list.invalidate();
      setSidebarOpen(false);
      toast.success("New private chat started in this project.");
    } catch {
      toast.error("That project could not be opened.");
    }
  };

  const createNewProject = async () => {
    const name = window.prompt("Project name", "New project")?.trim();
    if (!name) return;
    try {
      const project = await createProject.mutateAsync({ name });
      await updateProject.mutateAsync({ projectId: project.id, isPinned: true });
      await utils.projects.list.invalidate();
      toast.success("Private project created and pinned.");
    } catch {
      toast.error("Project could not be created.");
    }
  };

  const saveSetting = async (input: Parameters<typeof updateSettings.mutateAsync>[0]) => {
    try {
      await updateSettings.mutateAsync(input);
      await utils.workspace.settings.invalidate();
      toast.success("Workspace settings saved.");
    } catch {
      toast.error("Settings could not be saved.");
    }
  };

  const saveConversationProvider = async (provider: "omniroute" | "gemini") => {
    if (!activeConversationId) {
      toast("Start a conversation before selecting its provider.");
      return;
    }
    try {
      await selectConversationProvider.mutateAsync({ conversationId: activeConversationId, provider });
      await Promise.all([
        utils.conversations.get.invalidate({ conversationId: activeConversationId }),
        utils.conversations.list.invalidate(),
      ]);
      toast.success("Conversation provider updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider could not be selected.");
    }
  };

  const exportWorkspace = async () => {
    try {
      const result = await exportWorkspaceQuery.refetch();
      if (!result.data) throw new Error("Workspace export is unavailable.");
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `axis-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Your private workspace export is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace export could not be created.");
    }
  };

  const deleteWorkspace = async () => {
    const confirmation = window.prompt("Type DELETE MY AXIS DATA to permanently remove your chats, projects, settings, and file references.");
    if (confirmation !== "DELETE MY AXIS DATA") return;
    try {
      await deleteWorkspaceData.mutateAsync({ confirmation });
      setActiveConversationId(null);
      setAttachments([]);
      await Promise.all([
        utils.conversations.list.invalidate(),
        utils.projects.list.invalidate(),
        utils.workspace.settings.invalidate(),
      ]);
      toast.success("Your private workspace data has been deleted.");
    } catch {
      toast.error("Workspace data could not be deleted.");
    }
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!supportedFileTypes.has(file.type)) {
      toast.error("Use a PDF, TXT, Markdown, PNG, JPEG, or WebP attachment.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Attachments are limited to 10 MB.");
      return;
    }

    try {
      const conversationId = await ensureConversation();
      const base64Data = await fileToBase64(file);
      const response = await fetch("/api/chat/upload", {
        method: "POST",
        credentials: "include",
        headers: getAuthenticatedHeaders(),
        body: JSON.stringify({
          conversationId,
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        }),
      });
      const payload = (await response.json()) as { attachment?: PendingAttachment; error?: string };
      if (!response.ok || !payload.attachment) throw new Error(payload.error || "Attachment upload failed.");

      setAttachments(current => [...current, payload.attachment!]);
      await utils.conversations.get.invalidate({ conversationId });
      toast.success(`${file.name} is ready to use.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attachment upload failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitPrompt = async (text = draft) => {
    const content = text.trim();
    if (!content || isStreaming) return;
    if (!providerStatusQuery.data?.ready) {
      setSettingsOpen(true);
      toast.error("Live chat is paused until your approved OmniRoute gateway is configured.");
      return;
    }

    setDraft("");
    setDraftStatus("saved");
    try {
      localStorage.removeItem(`axis:draft:${user?.id}:${activeConversationId ?? "new"}`);
    } catch {
      // The prompt remains safe to send if local storage is not available.
    }
    setPendingPrompt(content);
    setStreamedResponse("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        credentials: "include",
        headers: getAuthenticatedHeaders(),
        body: JSON.stringify({
          conversationId: activeConversationId ?? undefined,
          content,
          attachmentIds: attachments.map(attachment => attachment.id),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "The assistant could not respond.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let conversationId = activeConversationId;

      const processEvent = async (event: string) => {
        const eventName = event.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const rawData = event.match(/^data:\s*(.+)$/m)?.[1];
        if (!eventName || !rawData) return;
        const payload = JSON.parse(rawData) as {
          id?: number;
          conversationId?: number;
          text?: string;
          error?: string;
          from?: string;
          to?: string;
        };

        if (eventName === "conversation" && payload.id) {
          conversationId = payload.id;
          setActiveConversationId(payload.id);
        }
        if (eventName === "token" && payload.text) {
          setStreamedResponse(current => current + payload.text!);
        }
        if (eventName === "provider_fallback" && payload.from && payload.to) {
          toast(`AXIS switched from ${payload.from} to ${payload.to} before the response started.`);
        }
        if (eventName === "error") throw new Error(payload.error || "The assistant could not respond.");
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let divider = buffer.indexOf("\n\n");
        while (divider !== -1) {
          const event = buffer.slice(0, divider);
          buffer = buffer.slice(divider + 2);
          await processEvent(event);
          divider = buffer.indexOf("\n\n");
        }
      }

      if (conversationId) {
        await Promise.all([
          utils.conversations.list.invalidate(),
          utils.conversations.get.invalidate({ conversationId }),
        ]);
      }
      setAttachments([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The assistant could not respond.";
      setStreamedResponse(`I couldn't complete that response. ${message}`);
      toast.error(message);
    } finally {
      setIsStreaming(false);
      setPendingPrompt("");
    }
  };

  if (loading) {
    return <div className="axis-shell min-h-screen" />;
  }

  if (!user) {
    return (
      <main className="axis-entry min-h-screen p-5 md:p-10">
        <div className="axis-entry-card mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border md:min-h-[calc(100vh-5rem)] md:flex-row">
          <section className="flex flex-1 flex-col justify-between p-8 md:p-14">
            <div className="flex items-center gap-3 text-sm font-semibold tracking-wide">
              <span className="axis-entry-mark grid size-9 place-items-center rounded-xl"><Sparkles className="size-4" /></span>
              AXIS
            </div>
            <div className="max-w-xl py-16">
              <p className="axis-entry-eyebrow mb-5 font-mono text-xs uppercase tracking-[0.22em]">Your private thinking space</p>
              <h1 className="font-[Newsreader] text-5xl leading-[0.98] tracking-[-0.055em] md:text-7xl">A calmer way to work through complex things.</h1>
              <p className="axis-entry-copy mt-7 max-w-md text-base leading-7">Chat, investigate, and build understanding—without losing the thread.</p>
            </div>
            <p className="axis-entry-footnote text-xs">Thoughtful tools for persistent work.</p>
          </section>
          <section className="axis-entry-panel flex w-full items-center p-8 md:w-[40%] md:p-12">
            <div className="w-full">
              <p className="axis-entry-panel-copy font-mono text-xs uppercase tracking-[0.18em]">Welcome</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Your conversations, kept in context.</h2>
              <p className="axis-entry-panel-copy mt-4 text-sm leading-6">Sign in to begin a private, persistent workspace.</p>
              <Button onClick={startLogin} className="axis-entry-primary mt-9 h-12 w-full rounded-xl hover:brightness-105">Continue with Manus</Button>
              {canInstall ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void install()}
                  className="axis-entry-secondary mt-3 h-11 w-full rounded-xl border bg-transparent"
                >
                  <Download className="mr-2 size-4" /> Install AXIS app
                </Button>
              ) : (
                <p className="axis-entry-panel-copy mt-4 text-center text-xs leading-5">{isInstalled ? "AXIS is installed on this device." : "On Android, use your browser menu to install AXIS as an app."}</p>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const storedMessages: ChatEntry[] = (conversationQuery.data?.messages ?? []).map(message => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));

  return (
    <main className="axis-shell flex min-h-screen">
      <aside className={cn(
        "axis-sidebar fixed inset-y-0 left-0 z-30 flex w-[290px] flex-col px-3 pb-4 pt-5 transition-transform md:static md:translate-x-0 md:shadow-none",
        focusMode && "md:hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-3 font-semibold tracking-[0.12em]">
            <span className="axis-accent-mark grid size-8 place-items-center rounded-lg"><Sparkles className="size-4" /></span>
            <span className="text-sm">AXIS</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 md:hidden" aria-label="Close menu"><X className="size-4" /></button>
        </div>

        <Button onClick={startNewConversation} className="axis-primary-control mt-8 h-11 w-full justify-start gap-2 rounded-xl px-4 hover:brightness-105">
          <Plus className="size-4" /> New chat
        </Button>

        <button onClick={() => { setCommandOpen(true); setSidebarOpen(false); }} className="mt-2 flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white">
          <Command className="size-4" /> Search & commands <kbd className="ml-auto rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/35">⌘K</kbd>
        </button>

        <div className="mt-6 px-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35"><span>Pinned projects</span><button onClick={() => void createNewProject()} className="axis-accent-icon rounded p-1 hover:bg-white/10" aria-label="Create project"><Plus className="size-3.5" /></button></div>
          <div className="mt-2 space-y-1">
            {projectsQuery.isLoading ? <div className="h-9 animate-pulse rounded-lg bg-white/10" /> : projectsQuery.data?.filter(project => project.isPinned).slice(0, 3).map(project => (
              <button key={project.id} onClick={() => void startProjectConversation(project.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"><FolderKanban className="axis-accent-icon size-3.5 opacity-75" /><span className="truncate">{project.name}</span></button>
            ))}
            {!projectsQuery.isLoading && !projectsQuery.data?.some(project => project.isPinned) && <p className="py-1 text-xs leading-5 text-white/30">Pin a project to keep it here.</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
          <span>Recent chats</span>
          <Search className="size-3.5" />
        </div>
        <nav className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {conversationsQuery.isLoading ? (
            <div className="space-y-2 px-2 pt-2"><div className="h-10 animate-pulse rounded-lg bg-white/10" /><div className="h-10 animate-pulse rounded-lg bg-white/10" /></div>
          ) : conversationsQuery.isError ? (
            <div className="mx-2 mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-white/55">
              <p>Conversations could not be loaded.</p>
              <button onClick={() => void conversationsQuery.refetch()} className="axis-accent-icon mt-2 font-semibold hover:brightness-110">Try again</button>
            </div>
          ) : conversationsQuery.data?.length ? (
            <div className="space-y-1">
              {conversationsQuery.data.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => chooseConversation(conversation.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    activeConversationId === conversation.id ? "axis-active-glass text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <MessageSquare className="axis-accent-icon size-4 shrink-0 opacity-75" />
                  <span className="min-w-0 flex-1 truncate text-sm">{conversation.title}</span>
                  <span className="text-[10px] text-white/30">{formatRelativeDate(conversation.lastMessageAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-5 text-xs leading-5 text-white/35">Your first conversation will appear here.</p>
          )}
        </nav>

        <div className="border-t border-white/10 pt-3">
          <button onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white">
            <Settings className="size-4" /> Settings
          </button>
          <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5">
            <span className="axis-account-avatar grid size-8 place-items-center rounded-full text-xs font-bold">{user.name?.slice(0, 1).toUpperCase() || "U"}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name || "Private workspace"}</span><span className="block truncate text-xs text-white/35">Signed in</span></span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="fixed inset-0 z-20 bg-black/35 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu overlay" />}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="axis-topbar flex h-[74px] items-center justify-between border-b px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
          <button onClick={() => setMobileSheetOpen(true)} className="axis-mobile-trigger grid size-9 place-items-center rounded-lg border md:hidden" aria-label="Open workspace actions"><Menu className="size-4" /></button>
            <div>
              <p className="axis-muted-copy font-mono text-[10px] uppercase tracking-[0.18em]">Private workspace</p>
              <h2 className="mt-0.5 truncate text-sm font-semibold tracking-[-0.02em]">{conversationQuery.data?.conversation.title || "New conversation"}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCommandOpen(true)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors lg:flex"><Search className="size-3.5" /> Search <kbd className="rounded border border-current/20 px-1 font-mono text-[9px]">⌘K</kbd></button>
            <button onClick={() => setFocusMode(current => !current)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors md:flex"><PanelLeftClose className="size-3.5" /> {focusMode ? "Exit focus" : "Focus"}</button>
            <button onClick={() => setSettingsOpen(true)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex"><Settings className="size-3.5" /> Settings</button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col pb-5 pt-9">
              {providerStatusQuery.isSuccess && !providerStatusQuery.data?.ready && (
                <GatewayUnavailableCard onOpenSettings={() => setSettingsOpen(true)} />
              )}
              {conversationQuery.isLoading && activeConversationId ? (
                <div className="space-y-5" aria-label="Loading conversation"><div className="axis-skeleton h-20 rounded-2xl" /><div className="axis-skeleton ml-auto h-16 w-2/3 rounded-2xl" /></div>
              ) : conversationQuery.isError && activeConversationId ? (
                <QueryError onRetry={() => void conversationQuery.refetch()} />
              ) : storedMessages.length || pendingPrompt ? (
                <div className="space-y-7">
                  {storedMessages.map(message => <MessageBubble key={message.id} message={message} />)}
                  {pendingPrompt && <MessageBubble message={{ id: -1, role: "user", content: pendingPrompt }} />}
                  {(isStreaming || streamedResponse) && <MessageBubble message={{ id: -2, role: "assistant", content: streamedResponse }} loading={isStreaming && !streamedResponse} />}
                </div>
              ) : (
                <EmptyConversation
                  onPrompt={submitPrompt}
                  onNewChat={startNewConversation}
                  onUpload={() => fileInputRef.current?.click()}
                  onResume={() => {
                    const project = projectsQuery.data?.[0];
                    if (project) void startProjectConversation(project.id);
                    else toast("Create or pin a project to resume focused work.");
                  }}
                />
              )}
              <div ref={messageEndRef} />
            </div>
          </div>

          <div className="px-4 pb-5 pt-2 md:px-8 md:pb-7">
            <div className="mx-auto w-full max-w-3xl">
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map(attachment => <AttachmentPill key={attachment.id} attachment={attachment} onRemove={() => setAttachments(current => current.filter(item => item.id !== attachment.id))} />)}
                </div>
              )}
              <form onSubmit={event => { event.preventDefault(); void submitPrompt(); }} className="axis-composer rounded-2xl border p-2">
                <Textarea value={draft} onChange={event => { setDraft(event.target.value); setDraftStatus("draft"); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitPrompt(); } }} placeholder="Message your assistant…" className="min-h-[68px] resize-none border-0 bg-transparent px-3 pt-3 text-[15px] shadow-none focus-visible:ring-0" disabled={isStreaming} />
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <div className="flex items-center gap-1">
                    <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,image/jpeg,image/png,image/webp" className="hidden" onChange={event => void handleFileSelect(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isStreaming || createConversation.isPending} className="axis-icon-control grid size-9 place-items-center rounded-xl transition-colors disabled:opacity-50" aria-label="Attach file"><Paperclip className="size-4" /></button>
                    <button type="button" onClick={() => toast("Voice input is prepared for the next AXIS release.")} className="axis-icon-control grid size-9 place-items-center rounded-xl transition-colors" aria-label="Voice input"><Mic className="size-4" /></button>
                    <button type="button" onClick={() => setCommandOpen(true)} className="axis-icon-control grid size-9 place-items-center rounded-xl transition-colors" aria-label="Open tools"><Wrench className="size-4" /></button>
                    <span className="axis-muted-copy hidden text-[11px] sm:block">Enter to send · Shift + Enter for new line</span>
                  </div>
                  <Button type="submit" disabled={!draft.trim() || isStreaming || !providerStatusQuery.data?.ready} aria-describedby={!providerStatusQuery.data?.ready ? "gateway-unavailable-hint" : undefined} className="axis-primary-control size-9 rounded-xl p-0 hover:brightness-105">
                    {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                    <span className="sr-only">Send message</span>
                  </Button>
                </div>
              </form>
              {providerStatusQuery.isSuccess && !providerStatusQuery.data?.ready && <p id="gateway-unavailable-hint" className="axis-warning-eyebrow mt-2 text-center text-xs">Chat is paused until the approved gateway is configured.</p>}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center"><WorkspaceStatus state={isStreaming ? "syncing" : draftStatus === "draft" ? "draft" : providerStatusQuery.data?.ready ? "online" : "saved"} /><span className="axis-muted-copy text-[11px]">AI can make mistakes. Check important information.</span></div>
            </div>
          </div>
        </div>
      </section>

      {mobileSheetOpen && (
        <div className="axis-overlay fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mobile workspace actions" onMouseDown={() => setMobileSheetOpen(false)}>
          <div className="axis-sheet absolute inset-x-0 bottom-0 rounded-t-[2rem] p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="axis-sheet-handle mx-auto mb-5 h-1.5 w-10 rounded-full" />
            <p className="axis-muted-copy px-1 font-mono text-[10px] uppercase tracking-[0.16em]">Workspace actions</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MobileAction icon={<Menu className="size-4" />} label="Menu" onClick={() => { setSidebarOpen(true); setMobileSheetOpen(false); }} />
              <MobileAction icon={<Search className="size-4" />} label="Search" onClick={() => { setCommandOpen(true); setMobileSheetOpen(false); }} />
              <MobileAction icon={<Plus className="size-4" />} label="New chat" onClick={startNewConversation} />
              <MobileAction icon={<Paperclip className="size-4" />} label="Upload file" onClick={() => { fileInputRef.current?.click(); setMobileSheetOpen(false); }} />
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="axis-overlay fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Settings">
          <aside className="axis-settings ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="axis-muted-copy font-mono text-[10px] uppercase tracking-[0.18em]">Account-synced workspace</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Settings</h3></div><button onClick={() => setSettingsOpen(false)} className="axis-icon-control grid size-9 place-items-center rounded-xl" aria-label="Close settings"><X className="size-4" /></button></div>
            <div className="axis-settings-card mt-6 divide-y rounded-2xl border px-4">
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Appearance</p><p className="axis-muted-copy mt-0.5 text-xs">Theme is synced to this private account.</p></div><button onClick={() => { toggleTheme?.(); void saveSetting({ theme: theme === "light" ? "dark" : "light" }); }} className="axis-icon-control grid size-9 place-items-center rounded-xl">{theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}</button></div>
              <div className="py-4"><p className="text-sm font-medium">Font size</p><div className="mt-3 flex gap-2">{(["compact", "comfortable", "large"] as const).map(size => <button key={size} onClick={() => void saveSetting({ fontSize: size })} className={cn("axis-settings-choice rounded-lg px-3 py-1.5 text-xs capitalize", settingsQuery.data?.fontSize === size ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{size}</button>)}</div></div>
              <div className="py-4"><p className="text-sm font-medium">Accent</p><div className="mt-3 flex gap-2">{(["lime", "sky", "violet"] as const).map(accent => <button key={accent} onClick={() => void saveSetting({ accent })} className={cn("size-8 rounded-full border-2 transition-transform hover:scale-105", accent === "lime" ? "bg-[#d7fa8a]" : accent === "sky" ? "bg-[#a7dcff]" : "bg-[#d6b4ff]", settingsQuery.data?.accent === accent ? "border-[#20231d]" : "border-transparent")} aria-label={`${accent} accent`} />)}</div></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Memory</p><p className="axis-muted-copy mt-0.5 text-xs">Use earlier messages in the same private chat.</p></div><button onClick={() => void saveSetting({ memoryEnabled: !settingsQuery.data?.memoryEnabled })} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", settingsQuery.data?.memoryEnabled ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{settingsQuery.data?.memoryEnabled ? "On" : "Off"}</button></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Privacy</p><p className="axis-muted-copy mt-0.5 text-xs">Strict keeps all workspace access user-scoped.</p></div><button onClick={() => void saveSetting({ privacy: settingsQuery.data?.privacy === "strict" ? "standard" : "strict" })} className="axis-settings-choice axis-settings-choice-inactive rounded-lg px-3 py-1.5 text-xs font-medium">{settingsQuery.data?.privacy || "strict"}</button></div>
              <div className="py-4"><p className="text-sm font-medium">Preferred model</p><p className="axis-muted-copy mt-0.5 text-xs">Saved per account; the current no-billing route still validates availability server-side.</p><input defaultValue={settingsQuery.data?.preferredModel || ""} onBlur={event => void saveSetting({ preferredModel: event.target.value.trim() || null })} placeholder="Auto (OmniRoute)" className="axis-input mt-3 h-10 w-full rounded-xl border px-3 text-sm outline-none" /></div>
              <div className="py-4"><p className="text-sm font-medium">AI provider</p><p className="axis-muted-copy mt-0.5 text-xs leading-5">{providerStatusQuery.data?.ready ? `${providerStatusQuery.data.label} is ready with ${providerStatusQuery.data.model}. AXIS exposes only configured, owner-approved providers.` : "No-billing safe mode is active. Add the server-only OmniRoute URL and token to enable live responses."}</p><div className="mt-3 flex flex-wrap gap-2">{providerStatusQuery.data?.eligibleProviders.map(provider => <button key={provider.id} onClick={() => void saveConversationProvider(provider.id)} className={cn("axis-settings-choice rounded-lg px-3 py-1.5 text-xs font-medium", conversationQuery.data?.conversation.provider === provider.id ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{provider.label}</button>)}</div></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Export private data</p><p className="axis-muted-copy mt-0.5 text-xs">Download chats, projects, settings, and file metadata.</p></div><button onClick={() => void exportWorkspace()} className="axis-icon-control grid size-9 place-items-center rounded-xl" aria-label="Export workspace"><Download className="size-4" /></button></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="axis-danger-label text-sm font-medium">Delete workspace data</p><p className="axis-muted-copy mt-0.5 text-xs">Permanently remove private chats, projects, settings, and file references.</p></div><button onClick={() => void deleteWorkspace()} className="axis-danger-action rounded-xl border px-3 py-2 text-xs font-medium">Delete</button></div>
            </div>
          </aside>
        </div>
      )}
      {commandOpen && (
        <div className="axis-overlay fixed inset-0 z-[60] p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search and commands" onMouseDown={() => setCommandOpen(false)}>
          <div className="axis-command mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border" onMouseDown={event => event.stopPropagation()}>
            <div className="axis-command-header flex items-center gap-3 border-b px-4"><Search className="size-4" /><input autoFocus value={commandQuery} onChange={event => setCommandQuery(event.target.value)} placeholder="Search chats, projects, files, or commands…" className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-inherit" /><kbd className="rounded border border-current/20 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd></div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              <p className="axis-muted-copy px-3 pb-2 pt-2 font-mono text-[10px] uppercase tracking-[0.16em]">Actions</p>
              <CommandRow icon={<Plus className="size-4" />} label="New chat" detail="Start a private conversation" onClick={() => { startNewConversation(); setCommandOpen(false); }} />
              <CommandRow icon={<FolderKanban className="size-4" />} label="New project" detail="Create and pin a private project" onClick={() => { void createNewProject(); setCommandOpen(false); }} />
              <CommandRow icon={<Paperclip className="size-4" />} label="Upload file" detail="Attach a private document or image" onClick={() => { fileInputRef.current?.click(); setCommandOpen(false); }} />
              <CommandRow icon={<Settings className="size-4" />} label="Workspace settings" detail="Theme, privacy, memory, and export" onClick={() => { setSettingsOpen(true); setCommandOpen(false); }} />
              <CommandRow icon={<PanelLeftClose className="size-4" />} label={focusMode ? "Exit focus mode" : "Enter focus mode"} detail="Reduce workspace distractions" onClick={() => { setFocusMode(current => !current); setCommandOpen(false); }} />
              <p className="axis-muted-copy px-3 pb-2 pt-5 font-mono text-[10px] uppercase tracking-[0.16em]">Recent chats</p>
              {conversationsQuery.data?.filter(chat => chat.title.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 5).map(chat => <CommandRow key={chat.id} icon={<MessageSquare className="size-4" />} label={chat.title} detail={formatRelativeDate(chat.lastMessageAt)} onClick={() => { chooseConversation(chat.id); setCommandOpen(false); }} />)}
              <p className="axis-muted-copy px-3 pb-2 pt-5 font-mono text-[10px] uppercase tracking-[0.16em]">Projects</p>
              {projectsQuery.data?.filter(project => project.name.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 5).map(project => <CommandRow key={project.id} icon={<FolderKanban className="size-4" />} label={project.name} detail={project.isPinned ? "Pinned project" : "Private project"} onClick={() => { void startProjectConversation(project.id); setCommandOpen(false); }} />)}
              <p className="axis-muted-copy px-3 pb-2 pt-5 font-mono text-[10px] uppercase tracking-[0.16em]">Private files</p>
              {filesQuery.data?.filter(file => file.fileName.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 5).map(file => <CommandRow key={file.id} icon={<FileText className="size-4" />} label={file.fileName} detail={`${file.mimeType.replace("application/", "")} · ${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`} onClick={() => { chooseConversation(file.conversationId); setCommandOpen(false); }} />)}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyConversation({ onPrompt, onNewChat, onUpload, onResume }: { onPrompt: (prompt: string) => void; onNewChat: () => void; onUpload: () => void; onResume: () => void }) {
  return (
    <div className="flex min-h-[48vh] flex-col justify-center py-10">
      <div className="axis-accent-mark grid size-11 place-items-center rounded-2xl"><Bot className="size-5" /></div>
      <p className="axis-muted-copy mt-7 font-mono text-[11px] uppercase tracking-[0.18em]">A focused place to think</p>
      <h1 className="mt-3 max-w-xl font-[Newsreader] text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl">Where should we begin?</h1>
      <p className="axis-muted-copy mt-4 max-w-lg text-sm leading-6">Ask a question, unpack an idea, or drop in a document. I’ll match your language and keep the thread intact.</p>
      <div className="mt-7 grid max-w-2xl gap-2 sm:grid-cols-3">
        <button onClick={onNewChat} className="axis-empty-action flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all hover:-translate-y-0.5"><Plus className="axis-accent-icon size-4" /> New chat</button>
        <button onClick={onUpload} className="axis-empty-action flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all hover:-translate-y-0.5"><Paperclip className="axis-accent-icon size-4" /> Upload file</button>
        <button onClick={onResume} className="axis-empty-action flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all hover:-translate-y-0.5"><FolderKanban className="axis-accent-icon size-4" /> Resume project</button>
      </div>
      <div className="mt-8 grid max-w-2xl gap-2 sm:grid-cols-3">
        {suggestedPrompts.map(prompt => <button key={prompt} onClick={() => onPrompt(prompt)} className="axis-prompt-chip rounded-2xl border p-4 text-left text-xs leading-5 transition-all hover:-translate-y-0.5">{prompt}</button>)}
      </div>
    </div>
  );
}

function GatewayUnavailableCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <section className="axis-warning mb-6 rounded-2xl border p-5" aria-live="polite" aria-labelledby="gateway-unavailable-title">
      <div className="flex items-start gap-3">
        <span className="axis-warning-mark mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl"><Wrench className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="axis-warning-eyebrow font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">{gatewayUnavailableGuidance.eyebrow}</p>
          <h2 id="gateway-unavailable-title" className="mt-1 text-base font-semibold tracking-[-0.02em]">{gatewayUnavailableGuidance.title}</h2>
          <p className="axis-warning-copy mt-2 max-w-2xl text-sm leading-6">{gatewayUnavailableGuidance.body}</p>
          <Button type="button" variant="outline" onClick={onOpenSettings} className="axis-warning-action mt-4 h-9 rounded-xl border">{gatewayUnavailableGuidance.action}</Button>
        </div>
      </div>
    </section>
  );
}

function CommandRow({ icon, label, detail, onClick }: { icon: React.ReactNode; label: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} className="axis-command-row flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors"><span className="axis-command-row-icon grid size-8 place-items-center rounded-lg shadow-sm">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{label}</span><span className="block truncate text-xs text-[color:var(--axis-muted)]">{detail}</span></span></button>;
}

function WorkspaceStatus({ state }: { state: "online" | "syncing" | "draft" | "saved" }) {
  const labels = { online: "Online · synced", syncing: "Syncing response", draft: "Draft saved soon", saved: "Draft saved locally" };
  const tones = { online: "axis-status-positive", syncing: "axis-status-positive", draft: "axis-status-neutral", saved: "axis-status-neutral" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium", tones[state])}><span className={cn("size-1.5 rounded-full", state === "syncing" ? "axis-status-dot-positive animate-pulse" : state === "online" ? "axis-status-dot-positive" : "axis-status-dot-neutral")} />{labels[state]}</span>;
}

function MobileAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="axis-mobile-action flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-medium"><span className="axis-accent-icon">{icon}</span>{label}</button>;
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[45vh] flex-col justify-center">
      <p className="axis-muted-copy font-mono text-[11px] uppercase tracking-[0.18em]">Connection interrupted</p>
      <h2 className="mt-3 font-[Newsreader] text-4xl tracking-[-0.045em]">This conversation could not be opened.</h2>
      <p className="axis-muted-copy mt-3 max-w-md text-sm leading-6">Your chat has not been changed. Check your connection and try loading it again.</p>
      <Button onClick={onRetry} variant="outline" className="axis-query-action mt-6 w-fit rounded-xl border">Try again</Button>
    </div>
  );
}

function MessageBubble({ message, loading = false }: { message: ChatEntry; loading?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <div className="axis-assistant-avatar mt-1 grid size-7 shrink-0 place-items-center rounded-lg"><Sparkles className="size-3.5" /></div>}
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-6 sm:max-w-[78%]", isUser ? "axis-user-message rounded-tr-sm" : "axis-message-assistant rounded-tl-sm border shadow-[0_3px_12px_rgba(37,42,33,0.03)]")}>
        {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : loading ? <div className="axis-thinking-copy flex items-center gap-2 py-1"><span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" /><i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" /><i className="size-1.5 animate-bounce rounded-full bg-current" /></span><span className="text-xs">Thinking</span></div> : <div className="assistant-markdown prose prose-sm max-w-none text-inherit"><Streamdown>{message.content}</Streamdown></div>}
      </div>
    </div>
  );
}

function AttachmentPill({ attachment, onRemove }: { attachment: PendingAttachment; onRemove: () => void }) {
  const icon = attachment.mimeType.startsWith("image/") ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />;
  return <div className="axis-attachment-pill flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-sm">{icon}<span className="max-w-[180px] truncate">{attachment.fileName}</span><button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded hover:bg-white/10" aria-label={`Remove ${attachment.fileName}`}><X className="size-3" /></button></div>;
}
