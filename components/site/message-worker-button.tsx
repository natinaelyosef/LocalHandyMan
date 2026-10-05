"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useLocale } from "@/context/locale";
import { useToast } from "@/hooks/use-toast";

export function MessageWorkerButton({ workerId }: { workerId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!user) return router.push(`/login?next=/workers/${workerId}`);
    if (user.role !== "customer") return toast({ title: t("public.message.onlyCustomers"), variant: "destructive" });
    setBusy(true);
    try {
      const res = await api<{ conversation: { _id: string } }>("/api/conversations", { body: { workerId } });
      router.push(`/dashboard/customer/messages/${res.conversation._id}`);
    } catch (err) {
      toast({ title: t("public.message.couldNotStart"), description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={open} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />} {t("public.message.button")}
    </Button>
  );
}
