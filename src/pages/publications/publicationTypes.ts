export type RecipientType = "teachers" | "students";
export type NotificationType = "urgent" | "warning" | "info";

export interface Publication {
  id: string;
  title: string;
  message: string;
  recipients: RecipientType[];
  createdAt: string;
  type: NotificationType;
}

export const RECIPIENT_LABELS: Record<RecipientType, string> = {
  teachers: "Teachers",
  students: "Students",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  urgent: "Urgent",
  warning: "Warning",
  info: "Info / News",
};
