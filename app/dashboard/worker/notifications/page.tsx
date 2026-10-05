"use client";

import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { WORKER_NAV } from "@/components/dashboard/nav-config";

export default function WorkerNotificationsPage() {
  return <NotificationsInbox role="worker" nav={WORKER_NAV} />;
}
