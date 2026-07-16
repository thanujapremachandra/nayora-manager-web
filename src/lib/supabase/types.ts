// Hand-written types matching 001_initial.sql.
// When you have a running Supabase project, replace with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts

export type ExportColumnSource =
  | 'tracking_numbers'
  | 'ref_id'
  | 'package_description'
  | 'receiver_name'
  | 'receiver_address'
  | 'receiver_city'
  | 'receiver_contact'
  | 'kilo'
  | 'gram'
  | 'amount'
  | 'exchange'
  | 'remark'
  | 'fixed'

// ─── User-designed slip template (Settings → Slip Designer) ──
export type SlipFieldKey =
  | 'business_name'
  | 'customer_name'
  | 'address'
  | 'phone_numbers'
  | 'ref_id'
  | 'tracking_number'
  | 'cod_amount'
  | 'weight'
  | 'footer_text'
  | 'remark'
  | 'custom_text'
  | 'box' // decorative rectangle — not bound to any order data

export type SlipTransform = 'none' | 'uppercase' | 'lowercase' | 'prefix' | 'suffix'

export interface SlipNode {
  id: string
  fieldKey: SlipFieldKey
  customText?: string
  x: number // mm from the slip's left edge
  y: number // mm from the slip's top edge
  width: number // mm
  height?: number // mm — only meaningful for the 'box' shape node
  fontSize: number // pt
  bold: boolean
  align: 'left' | 'center' | 'right'
  transform: SlipTransform
  transformArg?: string // text to add, for the prefix/suffix transforms
}

export interface SlipTemplate {
  nodes: SlipNode[]
}

// ─── User-designed slip placement on the A4 sheet (Settings → Slip Placement) ──
export interface SlipPlacement {
  id: string
  x: number // mm from the page's left edge
  y: number // mm from the page's top edge
  width: number // mm
  height: number // mm
}

export type DuplexFlipAxis = 'long-edge' | 'short-edge'

export interface SlipPlacementLayout {
  orientation: 'portrait' | 'landscape'
  duplexFlipAxis: DuplexFlipAxis
  placements: SlipPlacement[]
}

// ─── Database type (Supabase-compatible shape) ────────────────
export type Database = {
  public: {
    Tables: {
      settings: {
        Row: {
          id: string
          business_name: string
          address: string
          phone1: string
          phone2: string | null
          slip_footer_text: string
          default_low_stock_threshold: number
          default_courier_charge: number
          currency: string
          slip_template: SlipTemplate | null
          slip_placement_layout: SlipPlacementLayout | null
          default_order_entry_mode: 'stock' | 'text'
          exchange_keep_courier_charge: boolean
          bank_transfer_collect: boolean
          auto_weight_enabled: boolean
          auto_weight_mode: 'count' | 'price'
          auto_weight_threshold: number
          auto_weight_over_grams: number
          auto_weight_under_grams: number
          brand_color: string | null
          card_color_light: string | null
          card_color_dark: string | null
          bg_color_light: string | null
          bg_color_dark: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_name: string
          address: string
          phone1: string
          phone2?: string | null
          slip_footer_text: string
          default_low_stock_threshold: number
          default_courier_charge: number
          currency: string
          slip_template?: SlipTemplate | null
          slip_placement_layout?: SlipPlacementLayout | null
          default_order_entry_mode?: 'stock' | 'text'
          exchange_keep_courier_charge?: boolean
          bank_transfer_collect?: boolean
          auto_weight_enabled?: boolean
          auto_weight_mode?: 'count' | 'price'
          auto_weight_threshold?: number
          auto_weight_over_grams?: number
          auto_weight_under_grams?: number
          brand_color?: string | null
          card_color_light?: string | null
          card_color_dark?: string | null
          bg_color_light?: string | null
          bg_color_dark?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_name?: string
          address?: string
          phone1?: string
          phone2?: string | null
          slip_footer_text?: string
          default_low_stock_threshold?: number
          default_courier_charge?: number
          currency?: string
          slip_template?: SlipTemplate | null
          slip_placement_layout?: SlipPlacementLayout | null
          default_order_entry_mode?: 'stock' | 'text'
          exchange_keep_courier_charge?: boolean
          bank_transfer_collect?: boolean
          auto_weight_enabled?: boolean
          auto_weight_mode?: 'count' | 'price'
          auto_weight_threshold?: number
          auto_weight_over_grams?: number
          auto_weight_under_grams?: number
          brand_color?: string | null
          card_color_light?: string | null
          card_color_dark?: string | null
          bg_color_light?: string | null
          bg_color_dark?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          price_mode: 'global' | 'variant'
          global_price: number | null
          global_cost: number | null
          low_stock_threshold: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          price_mode?: 'global' | 'variant'
          global_price?: number | null
          global_cost?: number | null
          low_stock_threshold?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price_mode?: 'global' | 'variant'
          global_price?: number | null
          global_cost?: number | null
          low_stock_threshold?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_attributes: {
        Row: {
          id: string
          product_id: string
          name: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          name?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_attributes_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      attribute_values: {
        Row: {
          id: string
          attribute_id: string
          value: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          attribute_id: string
          value: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          attribute_id?: string
          value?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attribute_values_attribute_id_fkey'
            columns: ['attribute_id']
            isOneToOne: false
            referencedRelation: 'product_attributes'
            referencedColumns: ['id']
          }
        ]
      }
      variants: {
        Row: {
          id: string
          product_id: string
          name: string | null
          image_url: string | null
          on_hand: number
          reserved: number
          price: number | null
          cost: number | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name?: string | null
          image_url?: string | null
          on_hand?: number
          reserved?: number
          price?: number | null
          cost?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          name?: string | null
          image_url?: string | null
          on_hand?: number
          reserved?: number
          price?: number | null
          cost?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      variant_attribute_values: {
        Row: {
          variant_id: string
          attribute_value_id: string
        }
        Insert: {
          variant_id: string
          attribute_value_id: string
        }
        Update: {
          variant_id?: string
          attribute_value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'variant_attribute_values_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'variant_attribute_values_attribute_value_id_fkey'
            columns: ['attribute_value_id']
            isOneToOne: false
            referencedRelation: 'attribute_values'
            referencedColumns: ['id']
          }
        ]
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          image_url: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          image_url: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          image_url?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      stock_adjustments: {
        Row: {
          id: string
          variant_id: string
          delta: number
          reason: 'restock' | 'damage' | 'correction' | 'reserve' | 'release' | 'sold' | 'restore'
          note: string | null
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          delta: number
          reason: 'restock' | 'damage' | 'correction' | 'reserve' | 'release' | 'sold' | 'restore'
          note?: string | null
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          delta?: number
          reason?: 'restock' | 'damage' | 'correction' | 'reserve' | 'release' | 'sold' | 'restore'
          note?: string | null
          order_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          name: string
          status: 'pending' | 'completed'
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          name: string
          status?: 'pending' | 'completed'
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          status?: 'pending' | 'completed'
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          ref_id: string
          session_id: string
          customer_name: string
          address: string
          phone1: string
          phone2: string | null
          payment_type: 'cod' | 'bank'
          order_discount: number | null
          weight_grams: number | null
          status: 'pending' | 'frozen' | 'issue' | 'sent' | 'returned' | 'cancelled'
          freeze_stock_mode: 'reserved' | 'released' | null
          remarks: string | null
          cod_amount_override: number | null
          courier_charge_override: number | null
          is_exchange: boolean
          dispatched_via_session_complete_at: string | null
          package_description: string | null
          items_text: string | null
          items_amount: number | null
          legacy_mode: boolean
          exchange_keep_courier_override: boolean | null
          bank_collect_override: boolean | null
          auto_weight_override: boolean | null
          exchange_source_order_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ref_id?: string
          session_id: string
          customer_name: string
          address: string
          phone1: string
          phone2?: string | null
          payment_type?: 'cod' | 'bank'
          order_discount?: number | null
          weight_grams?: number | null
          status?: 'pending' | 'frozen' | 'issue' | 'sent' | 'returned' | 'cancelled'
          freeze_stock_mode?: 'reserved' | 'released' | null
          remarks?: string | null
          cod_amount_override?: number | null
          courier_charge_override?: number | null
          is_exchange?: boolean
          dispatched_via_session_complete_at?: string | null
          package_description?: string | null
          items_text?: string | null
          items_amount?: number | null
          legacy_mode?: boolean
          exchange_keep_courier_override?: boolean | null
          bank_collect_override?: boolean | null
          auto_weight_override?: boolean | null
          exchange_source_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ref_id?: string
          session_id?: string
          customer_name?: string
          address?: string
          phone1?: string
          phone2?: string | null
          payment_type?: 'cod' | 'bank'
          order_discount?: number | null
          weight_grams?: number | null
          status?: 'pending' | 'frozen' | 'issue' | 'sent' | 'returned' | 'cancelled'
          freeze_stock_mode?: 'reserved' | 'released' | null
          remarks?: string | null
          cod_amount_override?: number | null
          courier_charge_override?: number | null
          is_exchange?: boolean
          dispatched_via_session_complete_at?: string | null
          package_description?: string | null
          items_text?: string | null
          items_amount?: number | null
          legacy_mode?: boolean
          exchange_keep_courier_override?: boolean | null
          bank_collect_override?: boolean | null
          auto_weight_override?: boolean | null
          exchange_source_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          }
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          variant_id: string
          qty: number
          unit_price: number
          line_discount: number | null
          product_name_snapshot: string | null
          variant_label_snapshot: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          variant_id: string
          qty?: number
          unit_price: number
          line_discount?: number | null
          product_name_snapshot?: string | null
          variant_label_snapshot?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          variant_id?: string
          qty?: number
          unit_price?: number
          line_discount?: number | null
          product_name_snapshot?: string | null
          variant_label_snapshot?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'variants'
            referencedColumns: ['id']
          }
        ]
      }
      order_tracking: {
        Row: {
          id: string
          order_id: string
          tracking_number: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          tracking_number: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          tracking_number?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_tracking_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      tracking_pool: {
        Row: {
          id: string
          tracking_number: string
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tracking_number: string
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tracking_number?: string
          order_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_pool_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      dismissed_alerts: {
        Row: {
          id: string
          alert_key: string
          dismissed_at: string
        }
        Insert: {
          id?: string
          alert_key: string
          dismissed_at?: string
        }
        Update: {
          id?: string
          alert_key?: string
          dismissed_at?: string
        }
        Relationships: []
      }
      export_columns: {
        Row: {
          id: string
          position: number
          header_label: string
          source: ExportColumnSource
          fallback_value: string | null
          true_value: string | null
          false_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          position: number
          header_label: string
          source: ExportColumnSource
          fallback_value?: string | null
          true_value?: string | null
          false_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          position?: number
          header_label?: string
          source?: ExportColumnSource
          fallback_value?: string | null
          true_value?: string | null
          false_value?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      order_financials: {
        Row: {
          order_id: string
          session_id: string
          status: 'pending' | 'frozen' | 'issue' | 'sent' | 'returned' | 'cancelled'
          payment_type: 'cod' | 'bank'
          is_exchange: boolean
          order_discount: number | null
          cod_amount_override: number | null
          courier_charge_override: number | null
          created_at: string
          items_total: number
        }
        Relationships: []
      }
      order_item_sales: {
        Row: {
          order_item_id: string
          order_id: string
          variant_id: string
          qty: number
          unit_price: number
          line_discount: number | null
          line_revenue: number
          variant_cost: number | null
          variant_name: string | null
          price_mode: 'global' | 'variant'
          global_cost: number | null
          product_name: string
          order_status: 'pending' | 'frozen' | 'issue' | 'sent' | 'returned' | 'cancelled'
          order_created_at: string
          is_exchange: boolean
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ─── Convenience row types ────────────────────────────────────
export type Settings = Database['public']['Tables']['settings']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductImage = Database['public']['Tables']['product_images']['Row']
export type ProductAttribute = Database['public']['Tables']['product_attributes']['Row']
export type AttributeValue = Database['public']['Tables']['attribute_values']['Row']
export type Variant = Database['public']['Tables']['variants']['Row']
export type VariantAttributeValue = Database['public']['Tables']['variant_attribute_values']['Row']
export type StockAdjustment = Database['public']['Tables']['stock_adjustments']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type OrderTracking = Database['public']['Tables']['order_tracking']['Row']
export type TrackingPoolEntry = Database['public']['Tables']['tracking_pool']['Row']
export type DismissedAlert = Database['public']['Tables']['dismissed_alerts']['Row']
export type ExportColumn = Database['public']['Tables']['export_columns']['Row']
export type OrderFinancials = Database['public']['Views']['order_financials']['Row']
export type OrderItemSale = Database['public']['Views']['order_item_sales']['Row']

// Derived helpers
export type VariantWithAvailable = Variant & { available: number }

export function computeAvailable(v: Variant): number {
  return v.on_hand - v.reserved
}

// Money display helper: Rs. 1,250
export function formatRs(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
