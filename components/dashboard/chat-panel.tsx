"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, fileUrl, timeAgo } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";

type Message = {
  _id: string;
  senderId: string;
  type: "text" | "image" | "file" | "location";
  text: string;
  fileId?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  readBy: string[];
};

export function ChatPanel({ conversationId, otherName }: { conversationId: string; otherName?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async (silent = false) => {
    try {
      const data = await api<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages?limit=80`);
      setMessages(data.messages);
    } catch (err) {
      if (!silent) toast({ title: t("chat.loadFailed"), description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    try {
      if (file) {
        const form = new FormData();
        form.append("text", text);
        form.append("file", file);
        await api(`/api/conversations/${conversationId}/messages`, { form });
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      } else {
        await api(`/api/conversations/${conversationId}/messages`, { body: { text: text.trim() } });
      }
      setText("");
      await load(true);
    } catch (err) {
      toast({ title: t("chat.sendFailed"), description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{(otherName || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{otherName || t("shell.conversation")}</p>
          <p className="text-xs text-muted-foreground">{t("shell.aboutBooking")}</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 p-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const mine = m.senderId === user?._id;
              return (
                <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.deletedAt ? (
                      <em className="opacity-70">{t("chat.messageDeleted")}</em>
                    ) : (
                      <>
                        {m.type === "image" && m.fileId && (
                          <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer" className="mb-1 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileUrl(m.fileId)} alt="attachment" loading="lazy" decoding="async" className="max-h-48 rounded-lg object-cover" />
                          </a>
                        )}
                        {m.type === "file" && m.fileId && (
                          <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer" className="underline">
                            📎 {m.text || t("chat.attachment")}
                          </a>
                        )}
                        {m.type === "location" && m.text && <p>📍 {m.text}</p>}
                        {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                      </>
                    )}
                    <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {timeAgo(m.createdAt)}
                      {m.editedAt ? t("chat.edited") : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {file && (
        <div className="flex items-center gap-2 border-t px-4 py-2 text-sm">
          <Paperclip className="h-4 w-4" />
          <span className="truncate">{file.name}</span>
          <button onClick={() => setFile(null)} className="ml-auto" aria-label={t("chat.removeFile")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => fileInput.current?.click()} aria-label={t("chat.attachFile")}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder", { name: otherName ? otherName.split(" ")[0] : "" })}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending} aria-label={t("chat.send")}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
