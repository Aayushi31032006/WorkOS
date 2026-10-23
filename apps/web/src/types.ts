export interface User {
  id: string;
  name: string;
  avatar_url: string | null;
  presence?: "online" | "idle" | "dnd" | "offline";
  role?: string;
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
  member_count: number;
  unread_count?: number;
  last_message_at: string | null;
  other_user?: User;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
  reacted_by_me: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  author_id: string;
  author?: User;
  client_msg_id: string;
  seq: number;
  body: string;
  parent_id: string | null;
  reply_count: number;
  attachment_ids: string[];
  mention_ids: string[];
  object_reference_ids?: string[];
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  status?: "sending" | "sent" | "failed";
  reactions?: ReactionSummary[];
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  conversation_id: string;
  message_id: string | null;
  actor_id: string | null;
  is_read: boolean;
  created_at: string;
}