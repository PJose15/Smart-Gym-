import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { TrainerMessage } from '@nexera/types';

/**
 * Subscribes to realtime INSERT events on trainer_member_messages
 * for a specific member conversation.
 */
export function useRealtimeMessages(
  memberId: string,
  onNewMessage: (msg: TrainerMessage) => void
) {
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${memberId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trainer_member_messages',
          filter: `member_id=eq.${memberId}`,
        },
        (payload) => {
          const msg = payload.new as TrainerMessage;
          onNewMessage(msg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line
  }, [memberId]);
}
