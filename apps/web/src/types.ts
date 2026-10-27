export interface User {
  id: string;
  name: string;
  avatar_url: string | null;
  presence?: ("online" | "idle" | "dnd" | "offline") | undefined;
  role?: string | undefined;
}

export interface MeResponse {
  id: string;
  company_id: string;
  name: string;
  avatar_url: string | null;
  permissions: string[];
  company: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface Conversation {
  id: string;
  company_id: string;
  type: "channel" | "dm" | "group_dm";
  name: string | null;
  topic: string | null;
  kind: "company" | "department" | "project" | "public" | "private" | "announcement" | null;
  is_archived: boolean;
  is_announcement_only: boolean;
  member_count?: number | undefined;
  unread_count?: number | undefined;
  last_message_at: string | null;
  dm_user?: User | undefined;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
  reacted_by_me?: boolean | undefined;
}

export interface WorkOSObjectRef {
  type: "project" | "task" | "customer" | "invoice" | string;
  id: string;
  title: string;
  subtitle?: string | null | undefined;
  status?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AttachmentInfo {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  download_url?: string | undefined;
}

export interface Message {
  id: string;
  conversation_id: string;
  author_id: string;
  author?: User | undefined;
  author_name?: string | undefined;
  author_avatar_url?: string | null | undefined;
  is_system?: boolean | undefined;
  client_msg_id: string;
  seq: number;
  body: string;
  parent_id: string | null;
  reply_count: number;
  attachment_ids: string[];
  mention_ids: string[];
  object_reference_ids?: string[] | undefined;
  object_references?: WorkOSObjectRef[] | undefined;
  attachments?: AttachmentInfo[] | undefined;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  status?: ("sending" | "sent" | "failed") | undefined;
  reactions?: ReactionSummary[] | undefined;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  conversation_id: string;
  message_id: string | null;
  actor_id: string | null;
  actor_name?: string | null | undefined;
  actor_avatar_url?: string | null | undefined;
  conversation_name?: string | null | undefined;
  message_snippet?: string | null | undefined;
  is_read: boolean;
  created_at: string;
}
