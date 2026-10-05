"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { MessagesPage } from "@/components/dashboard/messages-page";
import { useLocale } from "@/context/locale";

export default function CustomerConversationPage() {
  const { t } = useLocale();
  return (
    <DashboardShell role="customer" nav={CUSTOMER_NAV} title={t("nav.messages")} subtitle={t("shell.conversation")}>
      <div className="mx-auto max-w-6xl">
        <MessagesPage basePath="/dashboard/customer/messages" />
      </div>
    </DashboardShell>
  );
}
