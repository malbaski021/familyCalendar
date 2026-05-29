export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      ai_queue: {
        Row: {
          attempts: number;
          created_at: string;
          error: string | null;
          event_id: string;
          id: string;
          processed_at: string | null;
          result: Json | null;
          status: Database['public']['Enums']['ai_queue_status'];
          tasks: Json;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          event_id: string;
          id?: string;
          processed_at?: string | null;
          result?: Json | null;
          status?: Database['public']['Enums']['ai_queue_status'];
          tasks: Json;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          event_id?: string;
          id?: string;
          processed_at?: string | null;
          result?: Json | null;
          status?: Database['public']['Enums']['ai_queue_status'];
          tasks?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_queue_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: Database['public']['Enums']['audit_actor_type'];
          created_at: string;
          entity: string;
          entity_id: string | null;
          family_id: string | null;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: Database['public']['Enums']['audit_actor_type'];
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          family_id?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: Database['public']['Enums']['audit_actor_type'];
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          family_id?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      children: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'children_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      drafts: {
        Row: {
          created_at: string;
          draft_data: Json;
          event_id: string | null;
          expires_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          draft_data: Json;
          event_id?: string | null;
          expires_at: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          draft_data?: Json;
          event_id?: string | null;
          expires_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drafts_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'drafts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      event_children: {
        Row: {
          child_id: string;
          event_id: string;
        };
        Insert: {
          child_id: string;
          event_id: string;
        };
        Update: {
          child_id?: string;
          event_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_children_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_children_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_instances: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          instance_date: string;
          is_cancelled: boolean;
          override_end_time: string | null;
          override_location: string | null;
          override_notes: string | null;
          override_start_time: string | null;
          override_title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          instance_date: string;
          is_cancelled?: boolean;
          override_end_time?: string | null;
          override_location?: string | null;
          override_notes?: string | null;
          override_start_time?: string | null;
          override_title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          instance_date?: string;
          is_cancelled?: boolean;
          override_end_time?: string | null;
          override_location?: string | null;
          override_notes?: string | null;
          override_start_time?: string | null;
          override_title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_instances_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_reminders: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          minutes_before: number;
          sent_at: string | null;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          minutes_before: number;
          sent_at?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          minutes_before?: number;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_reminders_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_shares: {
        Row: {
          created_at: string;
          created_by: string;
          event_id: string;
          id: string;
          opens_count: number;
          token: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          event_id: string;
          id?: string;
          opens_count?: number;
          token: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          event_id?: string;
          id?: string;
          opens_count?: number;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_shares_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_shares_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          category: Database['public']['Enums']['event_category'];
          created_at: string;
          created_by: string;
          end_date: string | null;
          end_time: string | null;
          family_id: string;
          id: string;
          location: string | null;
          locked_at: string | null;
          locked_by: string | null;
          notes: string | null;
          recurring_end_date: string | null;
          recurring_pattern: Database['public']['Enums']['recurring_pattern'] | null;
          start_date: string;
          start_time: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: Database['public']['Enums']['event_category'];
          created_at?: string;
          created_by: string;
          end_date?: string | null;
          end_time?: string | null;
          family_id: string;
          id?: string;
          location?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          notes?: string | null;
          recurring_end_date?: string | null;
          recurring_pattern?: Database['public']['Enums']['recurring_pattern'] | null;
          start_date: string;
          start_time?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: Database['public']['Enums']['event_category'];
          created_at?: string;
          created_by?: string;
          end_date?: string | null;
          end_time?: string | null;
          family_id?: string;
          id?: string;
          location?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          notes?: string | null;
          recurring_end_date?: string | null;
          recurring_pattern?: Database['public']['Enums']['recurring_pattern'] | null;
          start_date?: string;
          start_time?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_locked_by_fkey';
            columns: ['locked_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      families: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'families_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      family_members: {
        Row: {
          family_id: string;
          id: string;
          joined_at: string;
          role: Database['public']['Enums']['family_member_role'];
          user_id: string;
        };
        Insert: {
          family_id: string;
          id?: string;
          joined_at?: string;
          role?: Database['public']['Enums']['family_member_role'];
          user_id: string;
        };
        Update: {
          family_id?: string;
          id?: string;
          joined_at?: string;
          role?: Database['public']['Enums']['family_member_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_members_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      invite_links: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          family_id: string;
          id: string;
          role: Database['public']['Enums']['family_member_role'];
          status: Database['public']['Enums']['invite_link_status'];
          token: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at: string;
          family_id: string;
          id?: string;
          role: Database['public']['Enums']['family_member_role'];
          status?: Database['public']['Enums']['invite_link_status'];
          token: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          family_id?: string;
          id?: string;
          role?: Database['public']['Enums']['family_member_role'];
          status?: Database['public']['Enums']['invite_link_status'];
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invite_links_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_links_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_links_used_by_fkey';
            columns: ['used_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          error: string | null;
          event_id: string | null;
          id: string;
          payload: Json;
          scheduled_at: string;
          sent_at: string | null;
          status: Database['public']['Enums']['notification_status'];
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          event_id?: string | null;
          id?: string;
          payload: Json;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          event_id?: string | null;
          id?: string;
          payload?: Json;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          created_at: string;
          device_type: string | null;
          endpoint: string;
          id: string;
          last_used_at: string;
          subscription_data: Json;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_type?: string | null;
          endpoint: string;
          id?: string;
          last_used_at?: string;
          subscription_data: Json;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_type?: string | null;
          endpoint?: string;
          id?: string;
          last_used_at?: string;
          subscription_data?: Json;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          language: string;
          onboarded_at: string | null;
          role: Database['public']['Enums']['user_role'];
          status: Database['public']['Enums']['user_status'];
          updated_at: string;
          username: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id: string;
          language?: string;
          onboarded_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          status?: Database['public']['Enums']['user_status'];
          updated_at?: string;
          username: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          language?: string;
          onboarded_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          status?: Database['public']['Enums']['user_status'];
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      weather_cache: {
        Row: {
          event_id: string;
          fetched_at: string;
          forecast_data: Json;
          forecast_date: string;
          id: string;
        };
        Insert: {
          event_id: string;
          fetched_at?: string;
          forecast_data: Json;
          forecast_date: string;
          id?: string;
        };
        Update: {
          event_id?: string;
          fetched_at?: string;
          forecast_data?: Json;
          forecast_date?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weather_cache_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      event_family_id: { Args: { check_event_id: string }; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      is_family_member: { Args: { check_family_id: string }; Returns: boolean };
      is_family_owner: { Args: { check_family_id: string }; Returns: boolean };
    };
    Enums: {
      ai_queue_status: 'pending' | 'processing' | 'done' | 'failed';
      audit_actor_type: 'user' | 'ai' | 'system';
      event_category: 'birthday' | 'performance' | 'match' | 'school' | 'doctor' | 'other';
      family_member_role: 'owner' | 'member';
      invite_link_status: 'active' | 'used' | 'expired' | 'revoked';
      notification_status: 'queued' | 'sent' | 'failed';
      recurring_pattern: 'daily' | 'weekly' | 'monthly';
      user_role: 'admin' | 'user';
      user_status: 'active' | 'archived';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_queue_status: ['pending', 'processing', 'done', 'failed'],
      audit_actor_type: ['user', 'ai', 'system'],
      event_category: ['birthday', 'performance', 'match', 'school', 'doctor', 'other'],
      family_member_role: ['owner', 'member'],
      invite_link_status: ['active', 'used', 'expired', 'revoked'],
      notification_status: ['queued', 'sent', 'failed'],
      recurring_pattern: ['daily', 'weekly', 'monthly'],
      user_role: ['admin', 'user'],
      user_status: ['active', 'archived'],
    },
  },
} as const;
