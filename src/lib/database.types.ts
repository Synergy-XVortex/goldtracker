export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      gold_prices: {
        Row: {
          buy_cents: number | null
          buyback_cents: number | null
          fetched_at: string
          price_date: string
          product_id: number
          quote_cents: number
          source: string
          spot_eur_per_troy_ounce: number | null
          status: Database['public']['Enums']['price_status']
        }
        ComputedFields: never
        Insert: {
          buy_cents?: number | null
          buyback_cents?: number | null
          fetched_at?: string
          price_date: string
          product_id: number
          quote_cents: number
          source: string
          spot_eur_per_troy_ounce?: number | null
          status?: Database['public']['Enums']['price_status']
        }
        Update: {
          buy_cents?: number | null
          buyback_cents?: number | null
          fetched_at?: string
          price_date?: string
          product_id?: number
          quote_cents?: number
          source?: string
          spot_eur_per_troy_ounce?: number | null
          status?: Database['public']['Enums']['price_status']
        }
        Relationships: [
          {
            foreignKeyName: 'gold_prices_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      participants: {
        Row: {
          archived: boolean
          created_at: string
          display_name: string
          id: string
          portfolio_id: string
        }
        ComputedFields: never
        Insert: {
          archived?: boolean
          created_at?: string
          display_name: string
          id?: string
          portfolio_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          display_name?: string
          id?: string
          portfolio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'participants_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
      portfolio_members: {
        Row: {
          created_at: string
          participant_id: string | null
          portfolio_id: string
          role: Database['public']['Enums']['portfolio_role']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          participant_id?: string | null
          portfolio_id: string
          role?: Database['public']['Enums']['portfolio_role']
          user_id: string
        }
        Update: {
          created_at?: string
          participant_id?: string | null
          portfolio_id?: string
          role?: Database['public']['Enums']['portfolio_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'portfolio_members_participant_id_portfolio_id_fkey'
            columns: ['participant_id', 'portfolio_id']
            isOneToOne: false
            referencedRelation: 'participants'
            referencedColumns: ['id', 'portfolio_id']
          },
          {
            foreignKeyName: 'portfolio_members_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      price_fetch_runs: {
        Row: {
          detail: string | null
          finished_at: string | null
          id: number
          outcome: string
          product_id: number | null
          started_at: string
        }
        ComputedFields: never
        Insert: {
          detail?: string | null
          finished_at?: string | null
          id?: never
          outcome: string
          product_id?: number | null
          started_at?: string
        }
        Update: {
          detail?: string | null
          finished_at?: string | null
          id?: never
          outcome?: string
          product_id?: number | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_fetch_runs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          code: string
          created_at: string
          dealer_url: string | null
          fine_weight_grams: number
          id: number
          label: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          dealer_url?: string | null
          fine_weight_grams: number
          id?: never
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          dealer_url?: string | null
          fine_weight_grams?: number
          id?: never
          label?: string
        }
        Relationships: []
      }
      purchase_shares: {
        Row: {
          paid_cents: number
          participant_id: string
          portfolio_id: string
          purchase_id: string
        }
        ComputedFields: never
        Insert: {
          paid_cents: number
          participant_id: string
          portfolio_id: string
          purchase_id: string
        }
        Update: {
          paid_cents?: number
          participant_id?: string
          portfolio_id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_shares_participant_id_portfolio_id_fkey'
            columns: ['participant_id', 'portfolio_id']
            isOneToOne: false
            referencedRelation: 'participants'
            referencedColumns: ['id', 'portfolio_id']
          },
          {
            foreignKeyName: 'purchase_shares_purchase_id_portfolio_id_fkey'
            columns: ['purchase_id', 'portfolio_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id', 'portfolio_id']
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          fees_cents: number
          id: string
          note: string | null
          portfolio_id: string
          product_id: number
          purchased_on: string
          quantity: number
          seller: string | null
          total_price_cents: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          fees_cents?: number
          id?: string
          note?: string | null
          portfolio_id: string
          product_id: number
          purchased_on: string
          quantity?: number
          seller?: string | null
          total_price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fees_cents?: number
          id?: string
          note?: string | null
          portfolio_id?: string
          product_id?: number
          purchased_on?: string
          quantity?: number
          seller?: string | null
          total_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchases_portfolio_id_fkey'
            columns: ['portfolio_id']
            isOneToOne: false
            referencedRelation: 'portfolios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      portfolio_role: 'admin' | 'member'
      price_status: 'ok' | 'estimated' | 'quarantined'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      portfolio_role: ['admin', 'member'],
      price_status: ['ok', 'estimated', 'quarantined'],
    },
  },
} as const
