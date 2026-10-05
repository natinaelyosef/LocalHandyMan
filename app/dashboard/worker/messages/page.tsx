"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { MessagesPage } from "@/components/dashboard/messages-page";
import { useLocale } from "@/context/locale";

export default function WorkerMessagesPage() {
  const { t } = useLocale();
  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.messages")} subtitle={t("worker.messages.subtitle")}>
      <div className="mx-auto max-w-7xl">
        <MessagesPage basePath="/dashboard/worker/messages" />
      </div>
    </DashboardShell>
  );
}
