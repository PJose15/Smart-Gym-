/**
 * CommentsSheet — modal comment thread with input (DOC_05 §7).
 * Uses a plain RN Modal (no @gorhom/bottom-sheet dependency): slides up a
 * dark sheet with the thread, cursor "load more", and a keyboard-aware
 * composer pinned to the bottom. Own comments can be deleted.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FeedComment } from '@nexera/types';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { timeAgo } from '../../lib/feedLogic';
import { deleteComment, fetchComments, postComment } from '../../lib/feedService';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const MAX_COMMENT_LENGTH = 500;

interface CommentsSheetProps {
  eventId: string;
  myMemberId: string;
  onClose: () => void;
  /** Notifies the feed list so the card's comment count stays in sync. */
  onCommentCountChange: (eventId: string, delta: number) => void;
}

function CommentRow({
  comment,
  isOwn,
  onDelete,
}: {
  comment: FeedComment;
  isOwn: boolean;
  onDelete: (comment: FeedComment) => void;
}) {
  return (
    <View style={styles.commentRow}>
      {comment.avatar_url ? (
        <Image source={{ uri: comment.avatar_url }} style={styles.commentAvatar} />
      ) : (
        <View style={styles.commentAvatarFallback}>
          <Text style={styles.commentAvatarInitial}>
            {comment.member_name.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={styles.commentBubble}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{comment.member_name}</Text>
          <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          {isOwn && (
            <TouchableOpacity
              onPress={() => onDelete(comment)}
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteLabel}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.commentText}>{comment.comment_text}</Text>
      </View>
    </View>
  );
}

export function CommentsSheet({
  eventId,
  myMemberId,
  onClose,
  onCommentCountChange,
}: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(false);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await fetchComments(eventId);
      setComments(page.comments);
      setNextCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchComments(eventId, nextCursor);
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.comments.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      // keep existing thread; user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const created = await postComment(eventId, myMemberId, trimmed);
      setComments((prev) => [
        ...prev,
        {
          id: created.id,
          member_id: myMemberId,
          member_name: 'You',
          avatar_url: null,
          comment_text: trimmed,
          mentioned_member_ids: [],
          created_at: created.created_at,
        },
      ]);
      setText('');
      onCommentCountChange(eventId, 1);
    } catch {
      setError(true);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (comment: FeedComment) => {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    onCommentCountChange(eventId, -1);
    try {
      await deleteComment(comment.id, eventId);
    } catch {
      // Roll back the optimistic removal
      setComments(previous);
      onCommentCountChange(eventId, 1);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close comments"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
            <View style={styles.handle} />
            <Text variant="subheading" style={styles.title}>
              Comments
            </Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : error && comments.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Couldn&apos;t load comments.</Text>
                <TouchableOpacity onPress={load} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <CommentRow
                    comment={item}
                    isOwn={item.member_id === myMemberId}
                    onDelete={handleDelete}
                  />
                )}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No comments yet. Be first!</Text>
                }
                ListFooterComponent={
                  nextCursor ? (
                    <TouchableOpacity
                      onPress={handleLoadMore}
                      style={styles.loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={styles.loadMoreText}>Load more comments</Text>
                      )}
                    </TouchableOpacity>
                  ) : null
                }
              />
            )}

            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={MAX_COMMENT_LENGTH}
                multiline
                accessibilityLabel="Comment input"
              />
              <TouchableOpacity
                onPress={handlePost}
                disabled={!text.trim() || posting}
                style={[styles.sendButton, (!text.trim() || posting) && styles.sendButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Post comment"
              >
                {posting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.sendLabel}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetWrap: {
    maxHeight: '80%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '100%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.sm,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.smallSize,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: 12,
  },
  retryText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.white,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  loadMoreText: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontMedium,
    color: colors.primary,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm + 4,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    fontSize: typography.labelSize,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm + 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    flexShrink: 1,
  },
  commentTime: {
    fontSize: typography.tinySize,
    color: colors.textMuted,
    flex: 1,
  },
  deleteLabel: {
    fontSize: typography.tinySize,
    fontFamily: typography.fontMedium,
    color: colors.error,
  },
  commentText: {
    fontSize: typography.smallSize,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: typography.bodySize - 1,
    fontFamily: typography.fontRegular,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    maxHeight: 90,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendLabel: {
    fontSize: typography.smallSize,
    fontFamily: typography.fontSemiBold,
    color: colors.white,
  },
});
