"use client";

import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";

export default function CustomerNotificationsPage() {
  return <NotificationsInbox role="customer" nav={CUSTOMER_NAV} />;
}
