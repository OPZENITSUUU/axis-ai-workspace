import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { trpc } from "@/lib/trpc";
import { createChatDataReloadActions } from "@/lib/chatDataReloadActions";
import { createChatSubmissionLifecycle } from "@/lib/chatStreamPreview";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { gatewayUnavailableGuidance } from "@shared/providerGuidance";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import {
  ArrowUp,
  Bell,
  Bot,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Command,
  Copy,
  Download,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Library,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  Music2,
  Paperclip,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Square,
  Trash2,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ChatEntry = {
  id: number;
  role: "user" | "assistant";
  content: string;
  generationDurationMs?: number | null;
  generatedWordCount?: number | null;
};

type PendingAttachment = {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const suggestedPrompts = [
  "Mujhe ek difficult topic simple Hinglish mein samjhao",
  "Turn these notes into a focused study plan",
  "Review this idea and point out the weak assumptions",
];

const AXIS_ANDROID_APK_URL = "https://expo.dev/artifacts/eas/iW1GkaK1bBhe3d6HYg1qljvzEtnX24PQnYTBWA7nDZc.apk";

const supportedFileTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const defaultVoiceTuning = { rate: 1, pitch: 1 };

const promptTemplates = [
  { title: "Code bug fixer", detail: "Find root cause, safe fix, and test plan.", prompt: "Review the following code for bugs, security issues, and performance problems. Explain the root cause, give a minimal safe fix, and include tests.\n\n[PASTE CODE HERE]" },
  { title: "YouTube script", detail: "Create a hook, structure, and clear CTA.", prompt: "Write a high-retention YouTube script about [TOPIC] with a strong hook, clear sections, practical examples, and a natural call to action." },
  { title: "Resume writer", detail: "Turn experience into concise impact bullets.", prompt: "Help me write a targeted resume and cover letter for [ROLE]. Ask only for missing essentials, then use achievement-focused bullets and honest language." },
  { title: "Explain simply", detail: "Teach a hard topic with a friendly analogy.", prompt: "Explain [TOPIC] as if I am five years old. Use one simple analogy, short steps, and a quick recap without being patronizing." },
] as const;

const codeExtensionByLanguage: Record<string, string> = {
  bash: "sh", c: "c", cpp: "cpp", csharp: "cs", css: "css", html: "html", java: "java", javascript: "js", json: "json", jsx: "jsx", markdown: "md", md: "md", php: "php", python: "py", ruby: "rb", rust: "rs", shell: "sh", sql: "sql", ts: "ts", tsx: "tsx", typescript: "ts",
};

const codeExportExtensionsByLanguage: Record<string, readonly string[]> = {
  bash: ["sh", "bash", "txt"], c: ["c", "h", "txt"], cpp: ["cpp", "cc", "h", "txt"], csharp: ["cs", "txt"], css: ["css", "txt"], html: ["html", "htm", "txt"], java: ["java", "txt"], javascript: ["js", "mjs", "txt"], json: ["json", "txt"], jsx: ["jsx", "js", "txt"], markdown: ["md", "txt"], md: ["md", "txt"], php: ["php", "txt"], python: ["py", "txt"], ruby: ["rb", "txt"], rust: ["rs", "txt"], shell: ["sh", "bash", "txt"], sql: ["sql", "txt"], ts: ["ts", "tsx", "txt"], tsx: ["tsx", "ts", "txt"], typescript: ["ts", "tsx", "txt"], text: ["txt"],
};

const safeCodeExtensions = new Set(Object.values(codeExportExtensionsByLanguage).flat());

function getCodeBlocks(content: string) {
  return Array.from(content.matchAll(/```([a-zA-Z0-9+#-]*)\s*\n([\s\S]*?)```/g)).map((match, index) => ({
    id: index,
    language: match[1]?.toLowerCase() || "text",
    code: match[2] || "",
  }));
}

function getCodeExportExtensions(language: string) {
  return codeExportExtensionsByLanguage[language] || [codeExtensionByLanguage[language] || "txt", "txt"];
}

function downloadCodeFile(code: string, extension: string, index: number) {
  const safeExtension = safeCodeExtensions.has(extension) ? extension : "txt";
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `axis-code-${index + 1}.${safeExtension}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clampVoiceTuning(value: unknown, minimum: number, maximum: number, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

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

function base64UrlToUint8Array(value: string) {
  const normalized = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
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
  const [isListening, setIsListening] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [voiceFocusOpen, setVoiceFocusOpen] = useState(false);
  const [voiceTuning, setVoiceTuning] = useState(defaultVoiceTuning);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [focusAudioActive, setFocusAudioActive] = useState(false);
  const [streamedMetrics, setStreamedMetrics] = useState<{ generationDurationMs?: number; generatedWordCount?: number }>({});

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") {
      toast.success("AXIS is being added to your device.");
    } else if (outcome === "dismissed") {
      toast("You can install AXIS later from your browser menu.");
    } else {
      toast("Use your browser menu to install AXIS as an app.");
    }
  };

  const downloadAndroidApk = () => {
    window.location.assign(AXIS_ANDROID_APK_URL);
  };
  const [csvManagerOpen, setCsvManagerOpen] = useState(false);
  const [csvRenameId, setCsvRenameId] = useState<number | null>(null);
  const [csvRenameValue, setCsvRenameValue] = useState("");
  const [csvDeleteTarget, setCsvDeleteTarget] = useState<{ id: number; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const streamLifecycleRef = useRef(createChatSubmissionLifecycle());
  const voiceRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const focusAudioRef = useRef<{ context: AudioContext; source: AudioBufferSourceNode } | null>(null);

  useEffect(() => () => {
    const activeAudio = focusAudioRef.current;
    if (!activeAudio) return;
    activeAudio.source.stop();
    void activeAudio.context.close();
    focusAudioRef.current = null;
  }, []);

  const conversationsQuery = trpc.conversations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const providerStatusQuery = trpc.providers.status.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const filesQuery = trpc.files.list.useQuery(undefined, { enabled: isAuthenticated });
  const csvFilesQuery = trpc.files.listCsv.useQuery(undefined, { enabled: isAuthenticated && csvManagerOpen });
  const notificationStatusQuery = trpc.notifications.status.useQuery(undefined, { enabled: isAuthenticated });
  const settingsQuery = trpc.workspace.settings.useQuery(undefined, { enabled: isAuthenticated });
  const exportWorkspaceQuery = trpc.workspace.export.useQuery(undefined, { enabled: false });
  const conversationQuery = trpc.conversations.get.useQuery(
    { conversationId: activeConversationId ?? 0 },
    { enabled: isAuthenticated && activeConversationId !== null },
  );
  const chatDataReloadActions = createChatDataReloadActions({
    reloadConversation: () => { void conversationQuery.refetch(); },
    reloadConversationList: () => { void conversationsQuery.refetch(); },
  });
  const createConversation = trpc.conversations.create.useMutation();
  const createProject = trpc.projects.create.useMutation();
  const updateProject = trpc.projects.update.useMutation();
  const updateSettings = trpc.workspace.updateSettings.useMutation();
  const deleteWorkspaceData = trpc.workspace.deleteData.useMutation();
  const selectConversationProvider = trpc.conversations.selectProvider.useMutation();
  const renameCsvFile = trpc.files.renameCsv.useMutation();
  const deleteCsvFile = trpc.files.deleteCsv.useMutation();
  const updateNotificationPreferences = trpc.notifications.updatePreferences.useMutation();
  const registerWebPush = trpc.notifications.registerWeb.useMutation();
  const registerExpoPush = trpc.notifications.registerExpo.useMutation();

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
        setVoiceFocusOpen(false);
        setCsvManagerOpen(false);
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

  useEffect(() => {
    if (!user) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`axis:voice-tuning:${user.id}`) || "{}") as Partial<typeof defaultVoiceTuning>;
      setVoiceTuning({
        rate: clampVoiceTuning(stored.rate, 0.5, 1.8, defaultVoiceTuning.rate),
        pitch: clampVoiceTuning(stored.pitch, 0.5, 1.5, defaultVoiceTuning.pitch),
      });
    } catch {
      setVoiceTuning(defaultVoiceTuning);
    }
  }, [user?.id]);

  useEffect(() => {
    const handleNativeMessage = (event: MessageEvent) => {
      let payload: { type?: string; token?: string; message?: string; url?: string };
      try { payload = JSON.parse(String(event.data)); } catch { return; }
      if (payload.type === "axis-expo-push-token" && payload.token) {
        void registerExpoPush.mutateAsync({ token: payload.token })
          .then(() => updateNotificationPreferences.mutateAsync({ enabled: true }))
          .then(() => { void notificationStatusQuery.refetch(); toast.success("Android task alerts are enabled."); })
          .catch(() => toast.error("Android notification registration could not be saved."));
      }
      if (payload.type === "axis-expo-push-error") toast.error(payload.message || "Android notifications could not be enabled.");
      if (payload.type === "axis-notification-open" && payload.url) {
        const conversationId = Number(new URL(payload.url, window.location.origin).searchParams.get("conversation"));
        if (Number.isInteger(conversationId) && conversationId > 0) setActiveConversationId(conversationId);
      }
    };
    window.addEventListener("message", handleNativeMessage);
    document.addEventListener("message", handleNativeMessage as EventListener);
    return () => {
      window.removeEventListener("message", handleNativeMessage);
      document.removeEventListener("message", handleNativeMessage as EventListener);
    };
  }, [notificationStatusQuery, registerExpoPush, updateNotificationPreferences]);

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

  const exportConversation = () => {
    const messages = conversationQuery.data?.messages ?? [];
    if (!messages.length) {
      toast("Open a conversation with messages before exporting it.");
      return;
    }
    const title = conversationQuery.data?.conversation.title || "axis-conversation";
    const transcript = [
      `# ${title}`,
      "",
      ...messages.flatMap(message => [
        `## ${message.role === "user" ? "You" : "AXIS"}`,
        "",
        message.content,
        "",
      ]),
    ].join("\n");
    const blob = new Blob([transcript], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "axis-conversation"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Private conversation export is ready.");
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!supportedFileTypes.has(file.type)) {
      toast.error("Use a PDF, TXT, Markdown, CSV, PNG, JPEG, or WebP attachment.");
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

  const openCsvManager = () => {
    setCsvRenameId(null);
    setCsvRenameValue("");
    setCsvManagerOpen(true);
  };

  const beginCsvRename = (file: { id: number; fileName: string }) => {
    setCsvRenameId(file.id);
    setCsvRenameValue(file.fileName);
  };

  const saveCsvRename = async () => {
    if (!csvRenameId || !csvRenameValue.trim()) return;
    try {
      await renameCsvFile.mutateAsync({ attachmentId: csvRenameId, fileName: csvRenameValue });
      setCsvRenameId(null);
      setCsvRenameValue("");
      await Promise.all([utils.files.list.invalidate(), utils.files.listCsv.invalidate()]);
      toast.success("Private CSV file renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV file could not be renamed.");
    }
  };

  const removeCsvFile = async () => {
    if (!csvDeleteTarget) return;
    try {
      const removedId = csvDeleteTarget.id;
      await deleteCsvFile.mutateAsync({ attachmentId: removedId, confirmation: "DELETE CSV" });
      setCsvDeleteTarget(null);
      setAttachments(current => current.filter(attachment => attachment.id !== removedId));
      await Promise.all([
        utils.files.list.invalidate(),
        utils.files.listCsv.invalidate(),
        activeConversationId ? utils.conversations.get.invalidate({ conversationId: activeConversationId }) : Promise.resolve(),
      ]);
      toast.success("Private CSV file removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV file could not be removed.");
    }
  };

  const copyAssistantMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Assistant response copied.");
    } catch {
      toast.error("Copy is unavailable in this browser.");
    }
  };

  const updateVoiceTuning = (next: Partial<typeof defaultVoiceTuning>) => {
    const updated = {
      rate: clampVoiceTuning(next.rate ?? voiceTuning.rate, 0.5, 1.8, defaultVoiceTuning.rate),
      pitch: clampVoiceTuning(next.pitch ?? voiceTuning.pitch, 0.5, 1.5, defaultVoiceTuning.pitch),
    };
    setVoiceTuning(updated);
    try {
      localStorage.setItem(`axis:voice-tuning:${user?.id ?? "anonymous"}`, JSON.stringify(updated));
    } catch {
      // Voice tuning is a local browser preference; speech remains available without storage.
    }
  };

  const toggleFocusAudio = async () => {
    if (focusAudioRef.current) {
      const { context, source } = focusAudioRef.current;
      source.stop();
      await context.close();
      focusAudioRef.current = null;
      setFocusAudioActive(false);
      toast("Focus audio stopped.");
      return;
    }
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      toast.error("Focus audio is unavailable in this browser.");
      return;
    }
    const context = new AudioContextConstructor();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = (Math.random() * 2 - 1) * 0.32;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0.018;
    source.connect(gain).connect(context.destination);
    source.start();
    focusAudioRef.current = { context, source };
    setFocusAudioActive(true);
    toast("Local focus noise is playing. AXIS does not upload or track listening.");
  };

  const speakAssistantMessage = (content: string) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      toast.error("Text-to-speech is unavailable in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = navigator.language || "en-IN";
    utterance.rate = voiceTuning.rate;
    utterance.pitch = voiceTuning.pitch;
    window.speechSynthesis.speak(utterance);
    toast("Reading the assistant response aloud.");
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      voiceRecognitionRef.current?.stop();
      return;
    }

    const voiceWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice input is not supported by this browser. You can still type or attach a file.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language?.toLowerCase().startsWith("hi") ? "hi-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(result => result.isFinal)
        .map(result => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;
      setDraft(current => `${current}${current ? " " : ""}${transcript}`);
      setDraftStatus("draft");
    };
    recognition.onerror = event => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        toast.error("Voice input could not be captured. Check your microphone permission and try again.");
      }
    };
    recognition.onend = () => {
      voiceRecognitionRef.current = null;
      setIsListening(false);
    };
    voiceRecognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      toast("Listening through your browser’s voice service. Tap again to stop.");
    } catch {
      voiceRecognitionRef.current = null;
      setIsListening(false);
      toast.error("Voice input could not start. Check your microphone permission and try again.");
    }
  };

  const enableTaskAlerts = async () => {
    const nativeBridge = (window as Window & { ReactNativeWebView?: { postMessage: (value: string) => void } }).ReactNativeWebView;
    if (nativeBridge) {
      nativeBridge.postMessage(JSON.stringify({ type: "axis-request-expo-push" }));
      toast("AXIS is asking Android for notification permission.");
      return;
    }
    if (!notificationStatusQuery.data?.webPushAvailable) {
      toast.error("Browser push is being configured. Try again shortly.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      toast.error("This browser does not support private background task alerts.");
      return;
    }
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        toast("Notification permission was not granted. You can enable it later in browser settings.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(notificationStatusQuery.data.webPushPublicKey || ""),
      });
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) throw new Error("Browser subscription keys are unavailable.");
      await registerWebPush.mutateAsync({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth });
      await updateNotificationPreferences.mutateAsync({ enabled: true });
      await notificationStatusQuery.refetch();
      toast.success("Private task completion alerts are enabled on this device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Browser notifications could not be enabled.");
    }
  };

  const queueBackgroundPrompt = async (content: string) => {
    if (!providerStatusQuery.data?.ready) {
      setSettingsOpen(true);
      toast.error("Background tasks are paused until the approved gateway is configured.");
      return;
    }
    const clientRequestId = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `axis${Date.now()}${Math.random().toString(36).slice(2, 14)}`;
    try {
      setDraft("");
      setDraftStatus("saved");
      const response = await fetch("/api/chat/background", {
        method: "POST",
        credentials: "include",
        headers: getAuthenticatedHeaders(),
        body: JSON.stringify({
          conversationId: activeConversationId ?? undefined,
          content,
          attachmentIds: attachments.map(attachment => attachment.id),
          clientRequestId,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { task?: { id: number }; conversation?: { id: number }; error?: string };
      if (!response.ok || !payload.task) throw new Error(payload.error || "The task could not be queued.");
      if (payload.conversation?.id) setActiveConversationId(payload.conversation.id);
      setAttachments([]);
      await Promise.all([
        utils.conversations.list.invalidate(),
        utils.backgroundTasks.list.invalidate(),
        payload.conversation?.id ? utils.conversations.get.invalidate({ conversationId: payload.conversation.id }) : Promise.resolve(),
      ]);
      toast.success("AXIS is working in the background. You will get an alert when it is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The background task could not be queued.");
    }
  };

  const submitPrompt = async (text = draft) => {
    const content = text.trim();
    if (!content || isStreaming || streamLifecycleRef.current.isActive()) return;
    if (backgroundMode) {
      await queueBackgroundPrompt(content);
      return;
    }
    if (/^\/image(?:\s|$)/i.test(content)) {
      const prompt = content.replace(/^\/image\s*/i, "").trim();
      toast(prompt ? "Image generation is not active yet. Your prompt remains in the private draft; add an approved server-side image provider to enable it." : "Add a description after /image to prepare an image prompt.");
      return;
    }
    if (!providerStatusQuery.data?.ready) {
      setSettingsOpen(true);
      toast.error("Live chat is paused until your approved OmniRoute gateway is configured.");
      return;
    }

    const preview = streamLifecycleRef.current.tryStart(content);
    if (!preview) return;
    setDraft("");
    setDraftStatus("saved");
    try {
      localStorage.removeItem(`axis:draft:${user?.id}:${activeConversationId ?? "new"}`);
    } catch {
      // The prompt remains safe to send if local storage is not available.
    }
    setPendingPrompt(preview.pendingPrompt);
    setStreamedResponse(preview.streamedResponse);
    setStreamedMetrics({});
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
          generationDurationMs?: number;
          generatedWordCount?: number;
        };

        if (eventName === "conversation" && payload.id) {
          conversationId = payload.id;
          setActiveConversationId(payload.id);
        }
        if (eventName === "token" && payload.text) {
          setStreamedResponse(streamLifecycleRef.current.append(payload.text!).streamedResponse);
        }
        if (eventName === "provider_fallback" && payload.from && payload.to) {
          toast(`AXIS switched from ${payload.from} to ${payload.to} before the response started.`);
        }
        if (eventName === "done") {
          setStreamedMetrics({ generationDurationMs: payload.generationDurationMs, generatedWordCount: payload.generatedWordCount });
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
      const persistedPreview = streamLifecycleRef.current.finishAfterPersistedRefresh();
      setPendingPrompt(persistedPreview.pendingPrompt);
      setStreamedResponse(persistedPreview.streamedResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The assistant could not respond.";
      setStreamedResponse(`I couldn't complete that response. ${message}`);
      toast.error(message);
    } finally {
      streamLifecycleRef.current.release();
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
              <p className="axis-entry-eyebrow axis-editorial-label mb-5">Your private thinking space</p>
              <h1 className="axis-editorial-display">A calmer way to work through complex things.</h1>
              <p className="axis-entry-copy mt-7 max-w-md text-base leading-7">Chat, investigate, and build understanding—without losing the thread.</p>
            </div>
            <p className="axis-entry-footnote text-xs">Thoughtful tools for persistent work.</p>
          </section>
          <section className="axis-entry-panel flex w-full items-center p-8 md:w-[40%] md:p-12">
            <div className="w-full">
              <p className="axis-entry-panel-copy font-mono text-xs uppercase tracking-[0.18em]">Welcome</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Your conversations, kept in context.</h2>
              <p className="axis-entry-panel-copy mt-4 text-sm leading-6">Sign in to begin a private, persistent workspace.</p>
              <Button onClick={startLogin} className="axis-entry-primary axis-editorial-ghost mt-9 h-12 w-full hover:brightness-105">Continue with Manus</Button>
              {canInstall ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleInstall()}
                  className="axis-entry-secondary axis-editorial-ghost mt-3 h-11 w-full border bg-transparent"
                >
                  <Download className="mr-2 size-4" /> Install AXIS app
                </Button>
              ) : (
                <p className="axis-entry-panel-copy mt-4 text-center text-xs leading-5">{isInstalled ? "AXIS is installed on this device." : "On Android, use your browser menu to install AXIS as an app."}</p>
              )}
              <Button type="button" variant="outline" onClick={downloadAndroidApk} className="axis-entry-secondary axis-editorial-ghost mt-3 h-11 w-full border bg-transparent">
                <Download className="mr-2 size-4" /> Download Android APK <span className="ml-auto font-mono text-[10px] opacity-65">0.6.1</span>
              </Button>
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
    <main className="axis-shell flex h-[100dvh] overflow-hidden">
      <aside className={cn(
        "axis-sidebar fixed inset-y-0 left-0 z-30 flex w-[290px] flex-col px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] transition-transform md:static md:translate-x-0 md:shadow-none",
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
        <nav className="axis-scroll-region mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {conversationsQuery.isLoading ? (
            <div className="space-y-2 px-2 pt-2"><div className="h-10 animate-pulse rounded-lg bg-white/10" /><div className="h-10 animate-pulse rounded-lg bg-white/10" /></div>
          ) : conversationsQuery.isError ? (
            <div className="mx-2 mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-white/55">
              <p>Conversations could not be loaded.</p>
              <button onClick={chatDataReloadActions.retryConversationList} className="axis-accent-icon mt-2 font-semibold hover:brightness-110">Try again</button>
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

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="axis-topbar flex h-[74px] items-center justify-between border-b px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
          <button onClick={() => setMobileSheetOpen(true)} className="axis-mobile-trigger grid size-9 place-items-center rounded-lg border md:hidden" aria-label="Open workspace actions"><Menu className="size-4" /></button>
            <div>
              <p className="axis-muted-copy font-mono text-[10px] uppercase tracking-[0.18em]">Private workspace</p>
              <h2 className="mt-0.5 truncate text-sm font-semibold tracking-[-0.02em]">{conversationQuery.data?.conversation.title || "New conversation"}</h2>
            </div>
          </div>
            <div className="flex items-center gap-1">
            <span className="axis-muted-copy hidden rounded-full border border-white/10 px-2 py-1 text-[10px] capitalize lg:inline-flex">{settingsQuery.data?.assistantMode || "balanced"}</span>
            <button onClick={() => setPromptLibraryOpen(true)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors md:flex" aria-label="Open prompt library"><Library className="size-3.5" /> Prompts</button>
            <button onClick={() => void toggleFocusAudio()} aria-pressed={focusAudioActive} className={cn("axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors xl:flex", focusAudioActive && "axis-settings-choice-active")} aria-label={focusAudioActive ? "Stop local focus audio" : "Start local focus audio"}><Music2 className="size-3.5" /> {focusAudioActive ? "Focus on" : "Focus"}</button>
            {!isInstalled && canInstall && <button onClick={() => void handleInstall()} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors md:flex" aria-label="Install AXIS app"><Download className="size-3.5" /> Install</button>}
            <button onClick={downloadAndroidApk} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors lg:flex" aria-label="Download AXIS Android APK"><Download className="size-3.5" /> Android APK</button>
            <button onClick={exportConversation} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors xl:flex" aria-label="Export current private conversation"><Download className="size-3.5" /> Export</button>
            <button onClick={() => setCommandOpen(true)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors lg:flex"><Search className="size-3.5" /> Search <kbd className="rounded border border-current/20 px-1 font-mono text-[9px]">⌘K</kbd></button>
            <button onClick={() => setFocusMode(current => !current)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors md:flex"><PanelLeftClose className="size-3.5" /> {focusMode ? "Exit focus" : "Focus"}</button>
            <button onClick={() => setSettingsOpen(true)} className="axis-toolbar-control hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex"><Settings className="size-3.5" /> Settings</button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="axis-scroll-region min-h-0 flex-1 overflow-y-auto px-4 md:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col pb-5 pt-9">
              {providerStatusQuery.isSuccess && !providerStatusQuery.data?.ready && (
                <GatewayUnavailableCard onOpenSettings={() => setSettingsOpen(true)} />
              )}
              {conversationQuery.isLoading && activeConversationId ? (
                <div className="space-y-5" aria-label="Loading conversation"><div className="axis-skeleton h-20 rounded-2xl" /><div className="axis-skeleton ml-auto h-16 w-2/3 rounded-2xl" /></div>
              ) : conversationQuery.isError && activeConversationId ? (
                <QueryError onRetry={chatDataReloadActions.retryConversation} />
              ) : storedMessages.length || pendingPrompt ? (
                <div className="space-y-7">
                  {storedMessages.map(message => <MessageBubble key={message.id} message={message} onCopy={copyAssistantMessage} onSpeak={speakAssistantMessage} />)}
                  {pendingPrompt && <MessageBubble message={{ id: -1, role: "user", content: pendingPrompt }} onCopy={copyAssistantMessage} onSpeak={speakAssistantMessage} />}
                  {(isStreaming || streamedResponse) && <MessageBubble message={{ id: -2, role: "assistant", content: streamedResponse, ...streamedMetrics }} loading={isStreaming && !streamedResponse} onCopy={copyAssistantMessage} onSpeak={speakAssistantMessage} />}
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

          <div className="axis-composer-dock px-4 pb-2 pt-2 md:px-8 md:pb-4">
            <div className="mx-auto w-full max-w-3xl">
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map(attachment => <AttachmentPill key={attachment.id} attachment={attachment} onRemove={() => setAttachments(current => current.filter(item => item.id !== attachment.id))} />)}
                </div>
              )}
              <form onSubmit={event => { event.preventDefault(); void submitPrompt(); }} className={cn("axis-composer rounded-2xl border p-2", draft.trim() && !isStreaming && "axis-composer-ready", isStreaming && "axis-composer-streaming")}>
                <Textarea value={draft} onChange={event => { setDraft(event.target.value); setDraftStatus("draft"); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitPrompt(); } }} placeholder={backgroundMode ? "Describe a task for AXIS to complete in the background…" : "Message your assistant… Try /url https://example.com"} aria-label={backgroundMode ? "Background task for AXIS" : "Message your AXIS assistant"} enterKeyHint="send" autoCapitalize="sentences" className="min-h-[84px] resize-none border-0 bg-transparent px-3 pt-3 text-base shadow-none focus-visible:ring-0 sm:min-h-[68px] sm:text-[15px]" disabled={isStreaming} />
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <div className="flex items-center gap-1">
                    <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,text/csv,image/jpeg,image/png,image/webp" className="hidden" onChange={event => void handleFileSelect(event.target.files?.[0])} />
                    <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => void handleFileSelect(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isStreaming || createConversation.isPending} className="axis-icon-control grid size-10 place-items-center rounded-xl transition-colors disabled:opacity-50 sm:size-9" aria-label="Attach file"><Paperclip className="size-4" /></button>
                    <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isStreaming || createConversation.isPending} className="axis-icon-control grid size-10 place-items-center rounded-xl transition-colors disabled:opacity-50 sm:size-9" aria-label="Capture a private photo"><Camera className="size-4" /></button>
                    <button type="button" onClick={toggleVoiceInput} aria-pressed={isListening} className={cn("axis-icon-control grid size-10 place-items-center rounded-xl transition-colors sm:size-9", isListening && "axis-voice-recording")} aria-label={isListening ? "Stop voice input" : "Start voice input"}>{isListening ? <Square className="size-3.5" /> : <Mic className="size-4" />}</button>
                    <button type="button" onClick={() => setVoiceFocusOpen(true)} className="axis-icon-control hidden size-10 place-items-center rounded-xl transition-colors sm:grid sm:size-9" aria-label="Open Voice Note"><Volume2 className="size-4" /></button>
                    <button type="button" onClick={() => setBackgroundMode(current => !current)} aria-pressed={backgroundMode} className={cn("axis-icon-control grid size-10 place-items-center rounded-xl transition-colors sm:size-9", backgroundMode && "axis-settings-choice-active")} aria-label={backgroundMode ? "Turn off background task mode" : "Turn on background task mode"}><Clock3 className="size-4" /></button>
                    <button type="button" onClick={() => setPromptLibraryOpen(true)} className="axis-icon-control grid size-10 place-items-center rounded-xl transition-colors sm:size-9" aria-label="Open prompt library"><Library className="size-4" /></button>
                    <button type="button" onClick={() => void toggleFocusAudio()} aria-pressed={focusAudioActive} className={cn("axis-icon-control grid size-10 place-items-center rounded-xl transition-colors sm:size-9", focusAudioActive && "axis-settings-choice-active")} aria-label={focusAudioActive ? "Stop local focus audio" : "Start local focus audio"}><Music2 className="size-4" /></button>
                    <button type="button" onClick={() => setCommandOpen(true)} className="axis-icon-control grid size-10 place-items-center rounded-xl transition-colors sm:size-9" aria-label="Open tools"><Wrench className="size-4" /></button>
                    <span className="axis-muted-copy hidden text-[11px] sm:block">{backgroundMode ? "Background task · alert on completion" : "Enter to send · Shift + Enter · /url for a private page summary"}</span>
                  </div>
                  <Button type="submit" disabled={!draft.trim() || isStreaming || !providerStatusQuery.data?.ready} aria-describedby={!providerStatusQuery.data?.ready ? "gateway-unavailable-hint" : undefined} className={cn("axis-primary-control size-10 rounded-xl p-0 hover:brightness-105 sm:size-9", draft.trim() && !isStreaming && providerStatusQuery.data?.ready && "axis-send-ready")}>
                    {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                    <span className="sr-only">{backgroundMode ? "Queue background task" : "Send message"}</span>
                  </Button>
                </div>
              </form>
              {providerStatusQuery.isSuccess && !providerStatusQuery.data?.ready && <p id="gateway-unavailable-hint" className="axis-warning-eyebrow mt-2 text-center text-xs">Chat is paused until the approved gateway is configured.</p>}
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
              <MobileAction icon={<Camera className="size-4" />} label="Camera" onClick={() => { cameraInputRef.current?.click(); setMobileSheetOpen(false); }} />
              <MobileAction icon={<Library className="size-4" />} label="Prompt library" onClick={() => { setPromptLibraryOpen(true); setMobileSheetOpen(false); }} />
              <MobileAction icon={<Download className="size-4" />} label="Export chat" onClick={() => { exportConversation(); setMobileSheetOpen(false); }} />
              <MobileAction icon={<Download className="size-4" />} label="Android APK" onClick={downloadAndroidApk} />
              {!isInstalled && canInstall && <MobileAction icon={<Download className="size-4" />} label="Install app" onClick={() => { void handleInstall(); setMobileSheetOpen(false); }} />}
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
              <div className="py-4"><p className="text-sm font-medium">Assistant mode</p><p className="axis-muted-copy mt-0.5 text-xs">A private account-synced response style; AXIS keeps the same server-side provider boundary.</p><div className="mt-3 flex flex-wrap gap-2">{(["balanced", "study", "developer", "creative"] as const).map(mode => <button key={mode} onClick={() => void saveSetting({ assistantMode: mode })} className={cn("axis-settings-choice rounded-lg px-3 py-1.5 text-xs capitalize", settingsQuery.data?.assistantMode === mode ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{mode}</button>)}</div></div>
              <div className="py-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Memory bank</p><p className="axis-muted-copy mt-0.5 text-xs">Private instructions applied to future conversations only when Memory is on.</p></div><button onClick={() => void saveSetting({ memoryEnabled: !settingsQuery.data?.memoryEnabled })} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", settingsQuery.data?.memoryEnabled ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{settingsQuery.data?.memoryEnabled ? "On" : "Off"}</button></div><textarea key={settingsQuery.data?.memoryInstructions ?? "empty"} defaultValue={settingsQuery.data?.memoryInstructions || ""} maxLength={6000} onBlur={event => { const next = event.target.value.trim() || null; if (next !== (settingsQuery.data?.memoryInstructions || null)) void saveSetting({ memoryInstructions: next }); }} placeholder="Example: I am learning Python. Prefer concise Hinglish explanations and practical examples." className="axis-input mt-3 min-h-28 w-full resize-y rounded-xl border p-3 text-sm outline-none" aria-label="Private memory instructions" /></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Privacy</p><p className="axis-muted-copy mt-0.5 text-xs">Strict keeps all workspace access user-scoped.</p></div><button onClick={() => void saveSetting({ privacy: settingsQuery.data?.privacy === "strict" ? "standard" : "strict" })} className="axis-settings-choice axis-settings-choice-inactive rounded-lg px-3 py-1.5 text-xs font-medium">{settingsQuery.data?.privacy || "strict"}</button></div>
              <div className="py-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Background task alerts</p><p className="axis-muted-copy mt-0.5 text-xs leading-5">Receive a generic completion alert. AXIS never puts your private prompt or reply text in a notification.</p></div><button onClick={() => void enableTaskAlerts()} disabled={updateNotificationPreferences.isPending || registerWebPush.isPending || registerExpoPush.isPending} className={cn("axis-settings-choice rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50", notificationStatusQuery.data?.enabled ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{notificationStatusQuery.data?.enabled ? "Enabled" : "Enable"}</button></div><div className="mt-3 flex items-center justify-between gap-3"><span className="axis-muted-copy text-xs">Alert if a background task cannot finish</span><button onClick={() => void updateNotificationPreferences.mutateAsync({ errorAlerts: !notificationStatusQuery.data?.errorAlerts }).then(() => notificationStatusQuery.refetch())} className={cn("axis-settings-choice rounded-lg px-3 py-1.5 text-xs", notificationStatusQuery.data?.errorAlerts ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{notificationStatusQuery.data?.errorAlerts ? "On" : "Off"}</button></div>{notificationStatusQuery.data?.recentTasks.some(task => task.status === "queued" || task.status === "running") && <p className="axis-accent-icon mt-3 inline-flex items-center gap-1.5 text-xs"><Clock3 className="size-3.5" /> AXIS has a private task in progress.</p>}</div>
              <div className="py-4"><p className="text-sm font-medium">Preferred model</p><p className="axis-muted-copy mt-0.5 text-xs">Saved per account; the current no-billing route still validates availability server-side.</p><input defaultValue={settingsQuery.data?.preferredModel || ""} onBlur={event => void saveSetting({ preferredModel: event.target.value.trim() || null })} placeholder="Auto (OmniRoute)" className="axis-input mt-3 h-10 w-full rounded-xl border px-3 text-sm outline-none" /></div>
              <div className="py-4"><p className="text-sm font-medium">Browser voice tuning</p><p className="axis-muted-copy mt-0.5 text-xs leading-5">Applies only to the private Listen action in this browser. AXIS does not send these controls or message audio to an AI provider.</p><label className="axis-muted-copy mt-3 block text-xs" htmlFor="voice-rate">Speech speed <span className="float-right font-mono">{voiceTuning.rate.toFixed(1)}×</span></label><input id="voice-rate" type="range" min="0.5" max="1.8" step="0.1" value={voiceTuning.rate} onChange={event => updateVoiceTuning({ rate: Number(event.target.value) })} className="mt-2 w-full accent-[color:var(--axis-accent)]" /><label className="axis-muted-copy mt-4 block text-xs" htmlFor="voice-pitch">Speech pitch <span className="float-right font-mono">{voiceTuning.pitch.toFixed(1)}×</span></label><input id="voice-pitch" type="range" min="0.5" max="1.5" step="0.1" value={voiceTuning.pitch} onChange={event => updateVoiceTuning({ pitch: Number(event.target.value) })} className="mt-2 w-full accent-[color:var(--axis-accent)]" /></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Install AXIS</p><p className="axis-muted-copy mt-0.5 text-xs">Add this private workspace to your device for an app-like browser experience.</p></div>{isInstalled ? <span className="axis-settings-choice axis-settings-choice-active rounded-lg px-3 py-1.5 text-xs font-medium">Installed</span> : canInstall ? <button onClick={() => void handleInstall()} className="axis-toolbar-control rounded-xl px-3 py-2 text-xs font-medium">Install</button> : <span className="axis-muted-copy text-xs">Use browser menu</span>}</div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Android APK</p><p className="axis-muted-copy mt-0.5 text-xs">Download AXIS 0.6.1 directly for Android.</p></div><button onClick={downloadAndroidApk} className="axis-toolbar-control inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"><Download className="size-3.5" /> Download</button></div>
              <div className="py-4"><p className="text-sm font-medium">AI provider</p><p className="axis-muted-copy mt-0.5 text-xs leading-5">{providerStatusQuery.data?.ready ? `${providerStatusQuery.data.label} is ready with ${providerStatusQuery.data.model}. AXIS exposes only configured, owner-approved providers.` : "No-billing safe mode is active. Add the server-only OmniRoute URL and token to enable live responses."}</p><div className="mt-3 flex flex-wrap gap-2">{providerStatusQuery.data?.eligibleProviders.map(provider => <button key={provider.id} onClick={() => void saveConversationProvider(provider.id)} className={cn("axis-settings-choice rounded-lg px-3 py-1.5 text-xs font-medium", conversationQuery.data?.conversation.provider === provider.id ? "axis-settings-choice-active" : "axis-settings-choice-inactive")}>{provider.label}</button>)}</div></div>
              <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">CSV files</p><p className="axis-muted-copy mt-0.5 text-xs">View, rename, or remove CSV uploads that belong to this private account.</p></div><button onClick={openCsvManager} className="axis-toolbar-control rounded-xl px-3 py-2 text-xs font-medium" aria-label="Manage private CSV files">Manage</button></div>
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
              <CommandRow icon={<FileText className="size-4" />} label="Manage CSV files" detail="View, rename, or remove private CSV uploads" onClick={() => { openCsvManager(); setCommandOpen(false); }} />
              <CommandRow icon={<Library className="size-4" />} label="Prompt library" detail="Insert a useful template into the draft" onClick={() => { setPromptLibraryOpen(true); setCommandOpen(false); }} />
              <CommandRow icon={<Music2 className="size-4" />} label={focusAudioActive ? "Stop focus audio" : "Start focus audio"} detail="Generated locally; nothing is uploaded" onClick={() => { void toggleFocusAudio(); setCommandOpen(false); }} />
              {!isInstalled && canInstall && <CommandRow icon={<Download className="size-4" />} label="Install AXIS app" detail="Add this private workspace to your device" onClick={() => { void handleInstall(); setCommandOpen(false); }} />}
              <CommandRow icon={<Download className="size-4" />} label="Download Android APK" detail="Get AXIS 0.6.1 for Android" onClick={downloadAndroidApk} />
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
      {voiceFocusOpen && (
        <div className="axis-overlay fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Voice Note" onMouseDown={() => setVoiceFocusOpen(false)}>
          <div className="axis-command w-full max-w-md rounded-3xl border p-6 text-center" onMouseDown={event => event.stopPropagation()}>
            <div className={cn("axis-accent-mark mx-auto grid size-16 place-items-center rounded-full", isListening && "axis-voice-recording")}><Mic className="size-6" /></div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em]">Private Voice Note</p>
            <h3 className="mt-2 text-xl font-semibold">Speak, review, then send</h3>
            <p className="axis-muted-copy mt-3 text-sm leading-6">Your browser asks for microphone permission. AXIS adds the transcript to the private draft and never auto-sends it.</p>
            <div className="mt-6 flex justify-center gap-3"><button onClick={toggleVoiceInput} className="axis-primary-control rounded-xl px-4 py-2 text-sm font-medium">{isListening ? "Stop listening" : "Start listening"}</button><button onClick={() => setVoiceFocusOpen(false)} className="axis-toolbar-control rounded-xl px-4 py-2 text-sm">Close</button></div>
          </div>
        </div>
      )}
      {promptLibraryOpen && (
        <div className="axis-overlay fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Prompt library" onMouseDown={() => setPromptLibraryOpen(false)}>
          <div className="axis-command w-full max-w-2xl rounded-3xl border p-5 sm:p-6" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><p className="axis-muted-copy font-mono text-[10px] uppercase tracking-[0.16em]">Private drafting tools</p><h3 className="mt-1 text-lg font-semibold">Prompt library</h3><p className="axis-muted-copy mt-1 text-xs leading-5">Choose a template to place it in your draft. AXIS never auto-sends a template.</p></div><button onClick={() => setPromptLibraryOpen(false)} className="axis-icon-control grid size-9 place-items-center rounded-xl" aria-label="Close prompt library"><X className="size-4" /></button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{promptTemplates.map(template => <button key={template.title} onClick={() => { setDraft(template.prompt); setDraftStatus("draft"); setPromptLibraryOpen(false); }} className="axis-empty-action rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5"><span className="flex items-center gap-2 text-sm font-semibold"><Library className="axis-accent-icon size-4" />{template.title}</span><span className="axis-muted-copy mt-2 block text-xs leading-5">{template.detail}</span></button>)}</div>
          </div>
        </div>
      )}
      {csvManagerOpen && (
        <div className="axis-overlay fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Manage private CSV files" onMouseDown={() => setCsvManagerOpen(false)}>
          <div className="axis-command flex max-h-[min(680px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"><div><p className="axis-muted-copy font-mono text-[10px] uppercase tracking-[0.16em]">Private file manager</p><h3 className="mt-1 text-lg font-semibold">CSV files</h3><p className="axis-muted-copy mt-1 text-xs leading-5">Only CSV uploads from your signed-in AXIS account appear here.</p></div><button onClick={() => setCsvManagerOpen(false)} className="axis-icon-control grid size-9 place-items-center rounded-xl" aria-label="Close CSV file manager"><X className="size-4" /></button></div>
            <div className="axis-scroll-region min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {csvFilesQuery.isLoading ? (
                <div className="space-y-3"><div className="axis-skeleton h-20 rounded-2xl" /><div className="axis-skeleton h-20 rounded-2xl" /></div>
              ) : csvFilesQuery.isError ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm"><p>CSV files could not be loaded.</p><button onClick={() => void csvFilesQuery.refetch()} className="axis-danger-label mt-2 text-xs font-semibold">Try again</button></div>
              ) : csvFilesQuery.data?.length ? (
                <div className="space-y-3">
                  {csvFilesQuery.data.map(file => (
                    <article key={file.id} className="axis-settings-card rounded-2xl border p-4">
                      <div className="flex items-start gap-3"><div className="axis-accent-mark grid size-9 shrink-0 place-items-center rounded-xl"><FileText className="size-4" /></div><div className="min-w-0 flex-1">{csvRenameId === file.id ? <input autoFocus value={csvRenameValue} onChange={event => setCsvRenameValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void saveCsvRename(); if (event.key === "Escape") { setCsvRenameId(null); setCsvRenameValue(""); } }} className="axis-input h-9 w-full rounded-lg border px-2 text-sm outline-none" aria-label="CSV file name" /> : <p className="truncate text-sm font-medium">{file.fileName}</p>}<p className="axis-muted-copy mt-1 text-xs">{Math.max(1, Math.round(file.sizeBytes / 1024))} KB · Uploaded {formatRelativeDate(file.createdAt)}</p></div></div>
                      <div className="mt-4 flex justify-end gap-2">{csvRenameId === file.id ? <><button onClick={() => { setCsvRenameId(null); setCsvRenameValue(""); }} className="axis-toolbar-control rounded-lg px-3 py-1.5 text-xs">Cancel</button><button onClick={() => void saveCsvRename()} disabled={renameCsvFile.isPending || !csvRenameValue.trim()} className="axis-primary-control rounded-lg px-3 py-1.5 text-xs disabled:opacity-50">Save name</button></> : <><button onClick={() => beginCsvRename(file)} className="axis-toolbar-control inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"><Pencil className="size-3" /> Rename</button><button onClick={() => setCsvDeleteTarget({ id: file.id, fileName: file.fileName })} className="axis-danger-action inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs"><Trash2 className="size-3" /> Delete</button></>}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 p-7 text-center"><FileText className="axis-accent-icon mx-auto size-5" /><p className="mt-3 text-sm font-medium">No private CSV files yet</p><p className="axis-muted-copy mx-auto mt-2 max-w-sm text-xs leading-5">Upload a CSV from the composer to review its data with AXIS. It will appear here under your account.</p><button onClick={() => { setCsvManagerOpen(false); fileInputRef.current?.click(); }} className="axis-primary-control mt-4 rounded-xl px-4 py-2 text-xs font-medium">Upload CSV</button></div>
              )}
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={Boolean(csvDeleteTarget)} onOpenChange={open => { if (!open) setCsvDeleteTarget(null); }}>
        <AlertDialogContent className="axis-command border">
          <AlertDialogHeader><AlertDialogTitle>Delete private CSV file?</AlertDialogTitle><AlertDialogDescription>This removes the private file reference for <strong>{csvDeleteTarget?.fileName}</strong> from AXIS. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep file</AlertDialogCancel><AlertDialogAction onClick={() => void removeCsvFile()} className="axis-danger-action border">Delete CSV</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function MessageBubble({ message, loading = false, onCopy, onSpeak }: { message: ChatEntry; loading?: boolean; onCopy: (content: string) => void; onSpeak: (content: string) => void }) {
  const isUser = message.role === "user";
  const codeBlocks = isUser ? [] : getCodeBlocks(message.content);
  const metrics = !isUser && (message.generationDurationMs != null || message.generatedWordCount != null)
    ? [message.generationDurationMs != null ? `${(message.generationDurationMs / 1000).toFixed(1)}s` : null, message.generatedWordCount != null ? `${message.generatedWordCount} words` : null].filter(Boolean).join(" · ")
    : "";
  return (
    <div className={cn("axis-message-bubble flex gap-3", isUser ? "axis-message-user-wrap justify-end" : "justify-start")}>
      {!isUser && <div className="axis-assistant-avatar mt-1 grid size-7 shrink-0 place-items-center rounded-lg"><Sparkles className="size-3.5" /></div>}
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-6 sm:max-w-[78%]", isUser ? "axis-user-message axis-message-user rounded-tr-sm" : "axis-message-assistant axis-message-reply rounded-tl-sm border shadow-[0_3px_12px_rgba(37,42,33,0.03)]")}>
        {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : loading ? <div className="axis-thinking-copy flex items-center gap-2 py-1"><span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" /><i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" /><i className="size-1.5 animate-bounce rounded-full bg-current" /></span><span className="text-xs">Thinking</span></div> : <><div className="assistant-markdown prose prose-sm max-w-none text-inherit"><Streamdown controls={{ code: true, mermaid: true }} mermaidConfig={{ theme: "dark", securityLevel: "strict" }}>{message.content}</Streamdown></div>{metrics && <p className="axis-muted-copy mt-3 inline-flex items-center gap-1.5 text-[11px]"><Clock3 className="size-3" />{metrics}</p>}{codeBlocks.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{codeBlocks.map(block => <DropdownMenu key={block.id}><DropdownMenuTrigger asChild><button type="button" className="axis-message-action inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs" aria-label={`Choose download format for ${block.language || "text"} code`}><Download className="size-3" />Save code<ChevronDown className="size-3" /></button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuLabel>Download format</DropdownMenuLabel>{getCodeExportExtensions(block.language).map(extension => <DropdownMenuItem key={extension} onSelect={() => downloadCodeFile(block.code, extension, block.id)}>Save .{extension}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>)}</div>}<div className="axis-message-actions mt-3 flex items-center gap-1 border-t pt-2 text-xs"><button type="button" onClick={() => onSpeak(message.content)} className="axis-message-action inline-flex min-h-8 items-center gap-1 rounded-lg px-2" aria-label="Read assistant response aloud"><Volume2 className="size-3" />Listen</button><button type="button" onClick={() => void onCopy(message.content)} className="axis-message-action inline-flex min-h-8 items-center gap-1 rounded-lg px-2" aria-label="Copy assistant response"><Copy className="size-3" />Copy</button></div></>}
      </div>
    </div>
  );
}

function AttachmentPill({ attachment, onRemove }: { attachment: PendingAttachment; onRemove: () => void }) {
  const icon = attachment.mimeType.startsWith("image/") ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />;
  return <div className="axis-attachment-pill flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-sm">{icon}<span className="max-w-[180px] truncate">{attachment.fileName}</span><button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded hover:bg-white/10" aria-label={`Remove ${attachment.fileName}`}><X className="size-3" /></button></div>;
}
