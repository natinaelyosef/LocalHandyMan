"use client";

import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";

export default function AdminNotificationsPage() {
  return <NotificationsInbox role="admin" nav={ADMIN_NAV} />;
}
