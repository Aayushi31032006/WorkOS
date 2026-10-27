import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  AtSign,
  FolderKanban,
  Hash,
  Lock,
  MoreVertical,
  MessageSquare,
  CheckCheck,
  Clock,
  Sparkles,
  Settings,
  Users,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  CheckSquare,
  Building2,
  Receipt,
  FileText,
  AlertCircle,
  X,
  CornerDownRight,
  Pin,
  Download,
  Eye,
  UploadCloud,
  Check,
} from 'lucide-react';
import {
  Attachment,
  Channel,
  Message,
  TokenClaims,
  User,
  WorkOSObjectRef,
} from '../packages/contracts/types';
import {
  SYNTHETIC_OBJECTS,
  SYNTHETIC_USERS,
} from '../packages/test-fixtures/fixtures';
import { communicationEngine } from '../packages/sdk/client';
import { downloadAttachmentToDevice, processDeviceUpload } from '../utils/fileUtils';
import { PdfViewerModal } from './PdfViewerModal';

interface ConversationViewProps {
  claims: TokenClaims;
  channel: Channel;
  messages: Message[];
  onOpenThread: (message: Message) => void;
  onOpenObject: (obj: WorkOSObjectRef) => void;
  onCreateTask: (context: { messageId: string; content: string; authorName: string }) => void;
  onOpenChannelAdmin: (channel: Channel) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  claims,
  channel,
  messages,
  onOpenThread,
  onOpenObject,
  onCreateTask,
  onOpenChannelAdmin,
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<WorkOSObjectRef[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // PDF Preview & Pinned Drawer State
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [viewingAttachmentPinned, setViewingAttachmentPinned] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const canManageChannel = claims.permissions.includes('communication.channel.manage');
  const canSend = claims.permissions.includes('communication.message.send');
  const canModerate = claims.permissions.includes('communication.message.moderate');
  const isAnnouncementRestricted =
    channel.announcement_only &&
    !claims.permissions.includes('communication.announcement.publish');

  // Filter pinned messages in this channel
  const pinnedMessages = messages.filter((m) => m.is_pinned);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && selectedAttachments.length === 0 && selectedObjects.length === 0) {
      return;
    }

    if (isAnnouncementRestricted) {
      setErrorBanner('This channel is restricted to announcements published by authorized leads.');
      return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      const mentionedIds: string[] = [];
      Object.values(SYNTHETIC_USERS).forEach((u) => {
        if (content.includes(`@${u.name}`) || content.includes(`@${u.name.split(' ')[0]}`)) {
          mentionedIds.push(u.id);
        }
      });

      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      communicationEngine.sendMessage(claims, {
        channel_id: channel.id,
        content: content.trim(),
        attachments: selectedAttachments,
        object_refs: selectedObjects,
        mentions: mentionedIds,
        idempotency_key: idempotencyKey,
      });

      setContent('');
      setSelectedAttachments([]);
      setSelectedObjects([]);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Real Device File Upload Handler
  const handleDeviceFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (let i = 0; i < files.length; i++) {
        const processed = await processDeviceUpload(files[i]);
        setSelectedAttachments((prev) => [...prev, processed]);
      }
      setSuccessBanner(`Uploaded ${files.length} file(s) from your device.`);
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to read device file');
    } finally {
      e.target.value = '';
    }
  };

  // Drag and Drop files from device
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    try {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const processed = await processDeviceUpload(e.dataTransfer.files[i]);
        setSelectedAttachments((prev) => [...prev, processed]);
      }
      setSuccessBanner(`Uploaded ${e.dataTransfer.files.length} file(s) from device.`);
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      setErrorBanner('Failed to process dropped files');
    }
  };

  const insertMention = (user: User) => {
    setContent((prev) => `${prev}@${user.name} `);
    setShowMentionPicker(false);
    textareaRef.current?.focus();
  };

  const insertObject = (obj: WorkOSObjectRef) => {
    if (!selectedObjects.some((o) => o.id === obj.id)) {
      setSelectedObjects((prev) => [...prev, obj]);
    }
    setShowObjectPicker(false);
    textareaRef.current?.focus();
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    try {
      communicationEngine.toggleReaction(claims, messageId, emoji);
      setShowEmojiPicker(null);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleTogglePin = (messageId: string) => {
    try {
      const updated = communicationEngine.togglePinMessage(claims, messageId);
      if (updated.is_pinned) {
        setSuccessBanner('Message and attached PDF pinned to channel.');
      } else {
        setSuccessBanner('Message unpinned.');
      }
      setTimeout(() => setSuccessBanner(null), 2500);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editingContent.trim()) return;
    try {
      communicationEngine.editMessage(claims, messageId, editingContent.trim());
      setEditingMessageId(null);
      setEditingContent('');
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleDelete = (messageId: string) => {
    try {
      communicationEngine.deleteMessage(claims, messageId);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col h-full bg-[#f3f7fd] overflow-hidden relative ${
        isDraggingOver ? 'ring-4 ring-blue-500/50 ring-inset bg-blue-50/30' : ''
      }`}
    >
      {/* Hidden native device file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
        onChange={handleDeviceFilesSelected}
        className="hidden"
      />

      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-xs flex items-center justify-center z-40 border-2 border-dashed border-blue-500 rounded-2xl pointer-events-none">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-blue-900 font-bold text-sm">
            <UploadCloud className="w-6 h-6 text-blue-600 animate-bounce" />
            <span>Drop PDF or documents from your device to upload</span>
          </div>
        </div>
      )}

      {/* Channel Header (Blue Shade Styled) */}
      <div className="h-16 px-6 bg-white border-b border-blue-100 flex items-center justify-between shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 shrink-0 font-bold border border-blue-200">
            {channel.type === 'direct' ? (
              channel.name.slice(0, 2).toUpperCase()
            ) : channel.type === 'private' ? (
              <Lock className="w-4 h-4 text-blue-700" />
            ) : (
              <Hash className="w-4 h-4 text-blue-700" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 truncate tracking-tight">
                {channel.name}
              </h2>
              {channel.is_archived && (
                <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  Archived
                </span>
              )}
              {channel.announcement_only && (
                <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                  Announcements Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate max-w-xl">
              {channel.topic || channel.description || `${channel.member_ids.length} members`}
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Pinned Items Toggle Pill */}
          <button
            onClick={() => setShowPinnedDrawer(!showPinnedDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              showPinnedDrawer || pinnedMessages.length > 0
                ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Toggle pinned PDFs and messages"
          >
            <Pin className={`w-3.5 h-3.5 ${pinnedMessages.length > 0 ? 'fill-current text-blue-600' : ''}`} />
            <span>Pinned</span>
            {pinnedMessages.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-blue-600 text-white rounded-full font-mono text-[10px] font-bold">
                {pinnedMessages.length}
              </span>
            )}
          </button>

          {/* Linked WorkOS Object Pill if present */}
          {channel.linked_object && (
            <button
              onClick={() => onOpenObject(channel.linked_object!)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-900 transition"
              title="Click to view host WorkOS record"
            >
              <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-mono text-[11px] font-bold text-blue-700">
                {channel.linked_object.id}
              </span>
              <span className="truncate max-w-[130px]">{channel.linked_object.title}</span>
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/70">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">{channel.member_ids.length}</span>
          </div>

          <button
            onClick={() => onOpenChannelAdmin(channel)}
            className="p-2 rounded-xl text-slate-500 hover:text-blue-900 hover:bg-blue-50 transition"
            title="Channel settings and members"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pinned Messages & Documents Banner */}
      {showPinnedDrawer && (
        <div className="bg-blue-50/90 border-b border-blue-200/80 px-6 py-3 shrink-0 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <Pin className="w-3.5 h-3.5 fill-current text-blue-600" />
              <span>Pinned in #{channel.name} ({pinnedMessages.length})</span>
            </div>
            <button
              onClick={() => setShowPinnedDrawer(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {pinnedMessages.length === 0 ? (
            <p className="text-xs text-slate-500">
              No messages or PDFs pinned yet. Hover over any message or PDF and click the pin icon to pin it here!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-36 overflow-y-auto">
              {pinnedMessages.map((pMsg) => (
                <div
                  key={pMsg.id}
                  className="bg-white p-2.5 rounded-xl border border-blue-200 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      {pMsg.sender_name}
                    </div>
                    <div className="text-xs text-slate-600 truncate">{pMsg.content}</div>
                    {pMsg.attachments && pMsg.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium mt-0.5">
                        <FileText className="w-3 h-3" />
                        <span className="truncate">{pMsg.attachments[0].name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {pMsg.attachments && pMsg.attachments.length > 0 && (
                      <button
                        onClick={() => {
                          setViewingAttachment(pMsg.attachments[0]);
                          setViewingAttachmentPinned(true);
                        }}
                        className="p-1 hover:bg-blue-50 text-blue-600 rounded"
                        title="View PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleTogglePin(pMsg.id)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded"
                      title="Unpin"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {errorBanner && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center justify-between text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-blue-600 hover:text-blue-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message History Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Channel Welcome Header */}
        <div className="py-6 border-b border-blue-100 text-left">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl mb-3 shadow-md shadow-blue-500/20">
            {channel.type === 'direct' ? channel.name.slice(0, 2).toUpperCase() : '#'}
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome to #{channel.name}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            {channel.description ||
              'This is the start of the channel. Messages sent here are visible to authorized members.'}
          </p>
        </div>

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm">No messages yet. Send the first message or upload a document below!</p>
          </div>
        )}

        {/* Message Stream */}
        {messages.map((msg) => {
          const isSender = msg.sender_id === claims.sub;
          const isDeleted = msg.is_deleted;
          const isEditing = editingMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`group relative flex items-start gap-4 p-3 -mx-2.5 rounded-2xl transition ${
                msg.is_pinned
                  ? 'bg-blue-50/60 border border-blue-200/60'
                  : 'hover:bg-white/80'
              }`}
            >
              {/* Avatar Initials */}
              <div className="w-9 h-9 rounded-full bg-[#0a1a36] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {msg.sender_initials}
              </div>

              {/* Message Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900 hover:underline cursor-pointer">
                    {msg.sender_name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.is_edited && (
                    <span className="text-[10px] text-slate-400">(edited)</span>
                  )}
                  {msg.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.2 rounded-md">
                      <Pin className="w-3 h-3 fill-current" /> Pinned
                    </span>
                  )}
                  {msg.delivery_status === 'delivered' && (
                    <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                  )}
                </div>

                {/* Content / Edit Form */}
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full p-2.5 bg-white border border-blue-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdit(msg.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMessageId(null)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`text-sm leading-relaxed ${
                      isDeleted ? 'text-slate-400 italic' : 'text-slate-800'
                    } whitespace-pre-wrap`}
                  >
                    {msg.content.split(/(@[a-zA-Z0-9\s]+)/g).map((part, i) => {
                      if (part.startsWith('@')) {
                        return (
                          <span
                            key={i}
                            className="bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-md inline-block text-xs"
                          >
                            {part}
                          </span>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                )}

                {/* Linked WorkOS Objects */}
                {msg.object_refs && msg.object_refs.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {msg.object_refs.map((obj) => (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => onOpenObject(obj)}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-xs transition text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          {obj.type === 'project' && <FolderKanban className="w-3.5 h-3.5" />}
                          {obj.type === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                          {obj.type === 'customer' && <Building2 className="w-3.5 h-3.5" />}
                          {obj.type === 'invoice' && <Receipt className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-slate-900">
                              {obj.id}
                            </span>
                            {obj.status && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {obj.status}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 truncate max-w-[200px] font-medium">
                            {obj.title}
                          </div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Attachments with Real Device Download & Hover Preview */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="group/att p-3 bg-white rounded-2xl border border-blue-100/90 max-w-md shadow-2xs hover:border-blue-300 hover:shadow-xs transition flex items-center justify-between gap-3 relative"
                      >
                        <div
                          onClick={() => {
                            setViewingAttachment(att);
                            setViewingAttachmentPinned(!!msg.is_pinned);
                          }}
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                        >
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate group-hover/att:text-blue-600 transition">
                              {att.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {(att.size / 1024).toFixed(0)} KB · Click to preview or save
                            </div>
                          </div>
                        </div>

                        {/* Direct action buttons: View, Download, and Pin */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingAttachment(att);
                              setViewingAttachmentPinned(!!msg.is_pinned);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1"
                            title="Open & view document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadAttachmentToDevice(att)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-1 shadow-2xs"
                            title="Download to your device"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePin(msg.id)}
                            className={`p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition ${
                              msg.is_pinned ? 'text-amber-500 fill-current' : ''
                            }`}
                            title={msg.is_pinned ? 'Unpin PDF' : 'Pin PDF to channel'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reactions */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {msg.reactions.map((rx) => {
                    const hasReacted = rx.user_ids.includes(claims.sub);
                    return (
                      <button
                        key={rx.emoji}
                        type="button"
                        onClick={() => handleToggleReaction(msg.id, rx.emoji)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition ${
                          hasReacted
                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                            : 'bg-white border-blue-100 text-slate-700 hover:bg-blue-50/50'
                        }`}
                      >
                        <span>{rx.emoji}</span>
                        <span className="font-mono tabular-nums text-[11px]">{rx.count}</span>
                      </button>
                    );
                  })}

                  {/* Add reaction quick button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)
                      }
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-blue-50 transition"
                      title="Add reaction"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>

                    {showEmojiPicker === msg.id && (
                      <div className="absolute left-0 bottom-full mb-1 bg-white border border-blue-200 rounded-xl shadow-lg p-1.5 flex gap-1 z-30">
                        {['👍', '❤️', '🚀', '🎉', '🔥', '👀', '✅'].map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, em)}
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-sm transition"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Thread summary pill */}
                  {msg.thread_count > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenThread(msg)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-900 transition ml-1"
                    >
                      <CornerDownRight className="w-3.5 h-3.5 text-blue-600" />
                      <span>{msg.thread_count} {msg.thread_count === 1 ? 'reply' : 'replies'}</span>
                      {msg.last_reply_at && (
                        <span className="text-[11px] text-blue-400 font-normal">
                          · {msg.last_reply_at}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Hover Floating Action Bar */}
              {!isDeleted && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-2 bg-white border border-blue-200 rounded-xl shadow-sm flex items-center p-0.5 z-20">
                  <button
                    type="button"
                    onClick={() => handleTogglePin(msg.id)}
                    className={`p-1.5 rounded-lg transition ${
                      msg.is_pinned
                        ? 'text-amber-500 bg-amber-50'
                        : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                    title={msg.is_pinned ? 'Unpin message' : 'Pin message & PDF'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenThread(msg)}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                    title="Reply in thread"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onCreateTask({
                        messageId: msg.id,
                        content: msg.content,
                        authorName: msg.sender_name,
                      })
                    }
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                    title="Create WorkOS Task from Message"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>

                  {(isSender || canModerate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditingContent(msg.content);
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                      title="Edit message"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {(isSender || canModerate) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer with Device File Picker */}
      <div className="p-4 bg-white border-t border-blue-100 shrink-0">
        {/* Selected attachments/objects chips preview */}
        {(selectedAttachments.length > 0 || selectedObjects.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {selectedObjects.map((obj) => (
              <span
                key={obj.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium"
              >
                <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
                <span>{obj.id}: {obj.title}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedObjects((prev) => prev.filter((o) => o.id !== obj.id))
                  }
                  className="hover:text-blue-950"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>{att.name}</span>
                <span className="text-[10px] text-blue-500 font-mono">
                  ({(att.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedAttachments((prev) => prev.filter((a) => a.id !== att.id))
                  }
                  className="hover:text-rose-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="relative bg-slate-50/80 rounded-2xl border border-blue-100 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition p-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canSend || isAnnouncementRestricted}
            placeholder={
              isAnnouncementRestricted
                ? 'Only authorized announcement authors may post in this channel'
                : `Message #${channel.name}... (Press Enter to send, drag & drop files here)`
            }
            rows={2}
            className="w-full bg-transparent resize-none text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />

          {/* Action Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
            <div className="flex items-center gap-1 relative">
              {/* Device File Attachment (Opens Native File Picker) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
                title="Upload PDF or file from your computer/device"
              >
                <Paperclip className="w-4 h-4" />
                <span className="text-[11px] font-semibold hidden sm:inline">Attach file</span>
              </button>

              {/* Mentions trigger */}
              <button
                type="button"
                onClick={() => setShowMentionPicker(!showMentionPicker)}
                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                title="Mention colleague (@)"
              >
                <AtSign className="w-4 h-4" />
              </button>

              {/* WorkOS Object Linker */}
              <button
                type="button"
                onClick={() => setShowObjectPicker(!showObjectPicker)}
                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
                title="Link WorkOS Project, Task, or Invoice"
              >
                <FolderKanban className="w-4 h-4" />
              </button>

              {/* Emoji quick */}
              <button
                type="button"
                onClick={() =>
                  setShowEmojiPicker(showEmojiPicker === 'composer' ? null : 'composer')
                }
                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                title="Insert emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Mention popover */}
              {showMentionPicker && (
                <div className="absolute left-0 bottom-full mb-2 bg-white border border-blue-200 rounded-2xl shadow-xl p-2 w-64 z-30">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Mention Colleague
                  </div>
                  <div className="space-y-1">
                    {Object.values(SYNTHETIC_USERS)
                      .filter((u) => u.company_id === claims.company_id)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => insertMention(u)}
                          className="w-full px-2 py-1.5 rounded-xl text-left hover:bg-blue-50 flex items-center gap-2 transition"
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {u.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {u.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{u.role_title}</div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Object popover */}
              {showObjectPicker && (
                <div className="absolute left-24 bottom-full mb-2 bg-white border border-blue-200 rounded-2xl shadow-xl p-2 w-72 z-30">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Reference WorkOS Record
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {Object.values(SYNTHETIC_OBJECTS).map((obj) => (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => insertObject(obj)}
                        className="w-full px-2 py-1.5 rounded-xl text-left hover:bg-blue-50 flex items-center gap-2 transition"
                      >
                        <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-mono font-bold">
                          {obj.type === 'project' ? 'PRJ' : obj.type === 'task' ? 'TSK' : 'DOC'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {obj.id}: {obj.title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{obj.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Composer emoji picker */}
              {showEmojiPicker === 'composer' && (
                <div className="absolute left-32 bottom-full mb-2 bg-white border border-blue-200 rounded-xl shadow-xl p-2 flex gap-1 z-30">
                  {['👍', '❤️', '🚀', '🎉', '🔥', '👀', '💡', '✅'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setContent((prev) => `${prev} ${em} `);
                        setShowEmojiPicker(null);
                        textareaRef.current?.focus();
                      }}
                      className="p-1.5 hover:bg-blue-50 rounded-lg text-base transition"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button (Vibrant WorkOS Blue) */}
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (!content.trim() && selectedAttachments.length === 0 && selectedObjects.length === 0) ||
                isAnnouncementRestricted
              }
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* In-app PDF Viewer Modal */}
      {viewingAttachment && (
        <PdfViewerModal
          attachment={viewingAttachment}
          isPinned={viewingAttachmentPinned}
          onTogglePin={() => {
            const parentMsg = messages.find((m) =>
              m.attachments.some((a) => a.id === viewingAttachment.id)
            );
            if (parentMsg) {
              handleTogglePin(parentMsg.id);
              setViewingAttachmentPinned(!viewingAttachmentPinned);
            }
          }}
          onClose={() => setViewingAttachment(null)}
        />
      )}
    </div>
  );
};
