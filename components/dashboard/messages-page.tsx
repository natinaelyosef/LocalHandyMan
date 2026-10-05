"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatPanel } from "./chat-panel";
import { api, fileUrl, timeAgo } from "@/lib/client";
import { useLocale } from "@/context/locale";

type Convo = {
  _id: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  bookingId?: { _id: string; code: string; title: string; status: string } | null;
  customerId: { _id: string; name: string; avatarFileId?: string | null };
  workerId: { _id: string; name: string; avatarFileId?: string | null };
  otherUser: { _id: string; name: string; avatarFileId?: string | null };
};

export function MessagesPage({ basePath }: { basePath: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname.startsWith(basePath + "/") ? pathname.split("/").pop() : null;
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ conversations: Convo[] }>("/api/conversations")
      .then((d) => setConvos(d.conversations))
      .catch(() => {})
      .finally(() => setLoading(false));
    const t = setInterval(() => {
      api<{ conversations: Convo[] }>("/api/conversations").then((d) => setConvos(d.conversations)).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const active = convos.find((c) => c._id === activeId);

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[340px_1fr]">
      <div className="flex min-h-0 flex-col rounded-xl border bg-card">
        <div className="border-b px-4 py-3 font-semibold">{t("shell.conversations")}</div>
        <ScrollArea className="min-h-0 flex-1">
          {loading && (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && convos.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <MessageSquare className="h-7 w-7" />
              <p className="text-sm">{t("shell.conversationsEmpty")}</p>
            </div>
          )}
          {convos.map((c) => (
            <button
              key={c._id}
              onClick={() => router.push(`${basePath}/${c._id}`)}
              className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition hover:bg-muted/60 ${
                activeId === c._id ? "bg-muted" : ""
              }`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={c.otherUser?.avatarFileId ? fileUrl(c.otherUser.avatarFileId) : ""} />
                <AvatarFallback>{(c.otherUser?.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{c.otherUser?.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.lastMessage || t("shell.noMessagesYet")}</p>
                {c.bookingId ? (
                  <Badge variant="outline" className="mt-1 h-5 max-w-[180px] px-1.5 text-[10px]">
                    <span className="truncate">{t("shell.jobLabel", { title: c.bookingId.title })}</span>
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="mt-1 h-5 px-1.5 text-[10px]">
                    {t("shell.general")}
                  </Badge>
                )}
              </div>
              {c.unreadCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {c.unreadCount}
                </span>
              )}
            </button>
          ))}
        </ScrollArea>
      </div>

      <div className="min-h-0">
        {activeId ? (
          <div className="h-full">
            <ChatPanel conversationId={activeId} otherName={active?.otherUser?.name} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed bg-card text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p className="mt-3 font-medium text-foreground">{t("shell.selectConversation")}</p>
            <p className="text-sm">{t("shell.chatIntro")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
