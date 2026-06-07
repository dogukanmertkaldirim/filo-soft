export type ChecklistItemStatus = 'replaced' | 'checked' | 'na';

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistItemStatus;
}

export interface CustomOperation {
  id: string;
  name: string;
  notes: string;
}

export interface ServiceDetails {
  checklist: ChecklistItem[];
  custom_operations: CustomOperation[];
}

export type AgreedPaymentMethod = 'transfer' | 'credit_card' | 'cash' | 'check' | 'promissory_note';
export type PaymentMethod = 'cash' | 'credit_card_online' | 'credit_card_physical' | 'transfer' | 'check' | 'promissory_note';
export type CheckStatus = 'pending' | 'cleared' | 'bounced';
export type PaymentProvider = 'paytr' | 'iyzico' | 'paycell';
export type TransactionStatus = 'success' | 'failed' | 'pending_3d';
export type ProvisionStatus = 'active' | 'released' | 'captured' | 'partial_captured';
export type ProvisionPaymentMethod = 'credit_card' | 'cash' | 'transfer';

export interface Database {
  public: {
    Tables: {
      company_settings: {
        Row: {
          id: string;
          logo_url: string | null;
          company_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['company_settings']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['company_settings']['Insert']>;
      };
      partners: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          total_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['partners']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_balance'> & {
          id?: string;
          total_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['partners']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          customer_code: string | null;
          company_title: string;
          authorized_person: string | null;
          tax_id: string | null;
          email: string | null;
          address: string | null;
          tax_plate_url: string | null;
          signature_circular_url: string | null;
          trade_registry_url: string | null;
          findeks_report_url: string | null;
          is_blacklisted: boolean;
          blacklist_reason: string | null;
          tc_kimlik_no: string | null;
          first_name: string | null;
          last_name: string | null;
          father_name: string | null;
          birth_place: string | null;
          birth_date: string | null;
          passport_no: string | null;
          nationality: string | null;
          is_foreign: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_blacklisted' | 'customer_code'> & {
          id?: string;
          customer_code?: string | null;
          is_blacklisted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      reservations: {
        Row: {
          id: string;
          vehicle_id: string;
          customer_id: string;
          start_date: string;
          end_date: string;
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reservations']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'> & {
          id?: string;
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          service_type: string | null;
          service_types: string[];
          discount_spare_parts: number | null;
          discount_labor: number | null;
          payment_maturity: string | null;
          contract_file_url: string | null;
          company_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
          id?: string;
          service_types?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
      };
      vehicles: {
        Row: {
          id: string;
          plate: string;
          brand: string;
          model: string;
          year: number | null;
          color: string | null;
          chassis_number: string | null;
          photo_url: string | null;
          gallery_urls: string[];
          license_owner: string | null;
          license_document_url: string | null;
          initial_damage_status: string | null;
          damage_schema: Record<string, string> | null;
          purchase_price: number;
          purchase_date: string | null;
          status: 'idle' | 'rented' | 'sold' | 'maintenance';
          current_km: number | null;
          traffic_insurance_expiry: string | null;
          traffic_insurance_agency: string | null;
          traffic_insurance_agent_name: string | null;
          traffic_insurance_agent_phone: string | null;
          traffic_insurance_amount: number | null;
          traffic_insurance_policy_url: string | null;
          kasko_expiry: string | null;
          kasko_agency: string | null;
          kasko_agent_name: string | null;
          kasko_agent_phone: string | null;
          kasko_amount: number | null;
          kasko_policy_url: string | null;
          inspection_expiry: string | null;
          tire_type: 'summer' | 'winter' | 'all_season' | null;
          tire_size: string | null;
          tire_brand: string | null;
          spare_tire_location: string | null;
          has_tracker: boolean;
          tracker_model: string | null;
          tracker_serial_number: string | null;
          gps_provider: string | null;
          gps_device_id: string | null;
          gps_settings: Record<string, unknown> | null;
          has_spare_key: boolean;
          spare_key_location: string | null;
          fuel_type: string | null;
          transmission: string | null;
          daily_price: number | null;
          monthly_price: number | null;
          ownership_type: 'oz_mal' | 'kiralik';
          supplier_id: string | null;
          supplier_cost_price: number | null;
          supplier_cost_period: 'daily' | 'monthly' | null;
          supplier_start_date: string | null;
          supplier_end_date: string | null;
          supplier_contract_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['vehicles']['Row'], 'id' | 'created_at' | 'updated_at' | 'purchase_price' | 'status' | 'fuel_type' | 'transmission' | 'daily_price' | 'monthly_price' | 'ownership_type' | 'supplier_contract_url'> & {
          id?: string;
          purchase_price?: number;
          status?: 'idle' | 'rented' | 'sold' | 'maintenance';
          fuel_type?: string | null;
          transmission?: string | null;
          daily_price?: number | null;
          monthly_price?: number | null;
          ownership_type?: 'oz_mal' | 'kiralik';
          supplier_contract_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
      };
      vehicle_partners: {
        Row: {
          id: string;
          vehicle_id: string;
          partner_id: string;
          share_percentage: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['vehicle_partners']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vehicle_partners']['Insert']>;
      };
      loans: {
        Row: {
          id: string;
          loan_type: 'vehicle' | 'capital';
          vehicle_id: string | null;
          owner_partner_id: string | null;
          bank: string;
          title: string | null;
          maturity_date: string;
          total_amount: number;
          installment_count: number;
          payment_day: number;
          installment_amount: number;
          total_payback_amount: number;
          remaining_debt: number;
          capital_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['loans']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['loans']['Insert']>;
      };
      loan_payments: {
        Row: {
          id: string;
          loan_id: string;
          payment_date: string;
          amount: number;
          is_paid: boolean;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['loan_payments']['Row'], 'id' | 'created_at' | 'is_paid'> & {
          id?: string;
          is_paid?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['loan_payments']['Insert']>;
      };
      rentals: {
        Row: {
          id: string;
          vehicle_id: string;
          customer_id: string;
          start_date: string;
          end_date: string;
          start_datetime: string | null;
          end_datetime: string | null;
          starting_km: number | null;
          fuel_status: 'empty' | '1/4' | '1/2' | '3/4' | 'full' | null;
          deposit_amount: number;
          daily_rate: number;
          daily_km_limit: number | null;
          per_km_overage_fee: number | null;
          total_amount: number;
          status: 'active' | 'completed' | 'cancelled';
          notes: string | null;
          initial_damage_notes: string | null;
          start_cleanliness_status: 'clean' | 'normal' | 'dirty' | null;
          contract_document_url: string | null;
          return_datetime: string | null;
          return_km: number | null;
          return_fuel_status: 'empty' | '1/4' | '1/2' | '3/4' | 'full' | null;
          return_cleanliness_status: 'clean' | 'normal' | 'dirty' | null;
          handover_document_url: string | null;
          return_damage_notes: string | null;
          kabis_notification_status: boolean;
          kabis_reported_by: string | null;
          kabis_reported_at: string | null;
          company_profile_id: string | null;
          billing_type: 'upfront' | 'monthly';
          contract_months: number | null;
          tax_rate: number;
          withholding_rate: 'none' | '5/10' | '7/10' | '9/10' | 'full_exemption';
          currency: string;
          payment_timing: 'beginning_of_period' | 'end_of_period';
          rental_type: 'short_term' | 'operational_leasing';
          rental_model: 'rent_a_car' | 'operational_leasing' | 'financial_leasing';
          contract_duration_months: number | null;
          early_termination_fee: number;
          services_included: string[];
          agreed_payment_method: AgreedPaymentMethod;
          down_payment: number;
          monthly_km_limit: number | null;
          transfer_ownership: boolean;
          early_termination_logic: string;
          monthly_price: number | null;
          delivery_damage_condition: Record<string, string> | null;
          return_damage_condition: Record<string, string> | null;
          start_fuel_percentage: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rentals']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'deposit_amount' | 'kabis_notification_status' | 'kabis_reported_by' | 'kabis_reported_at' | 'company_profile_id' | 'billing_type' | 'contract_months' | 'tax_rate' | 'withholding_rate' | 'currency' | 'payment_timing' | 'rental_type' | 'rental_model' | 'contract_duration_months' | 'early_termination_fee' | 'services_included' | 'agreed_payment_method' | 'down_payment' | 'monthly_km_limit' | 'transfer_ownership' | 'early_termination_logic' | 'monthly_price' | 'delivery_damage_condition' | 'return_damage_condition' | 'start_fuel_percentage'> & {
          kabis_notification_status?: boolean;
          kabis_reported_by?: string | null;
          kabis_reported_at?: string | null;
          company_profile_id?: string | null;
          billing_type?: 'upfront' | 'monthly';
          contract_months?: number | null;
          tax_rate?: number;
          withholding_rate?: 'none' | '5/10' | '7/10' | '9/10' | 'full_exemption';
          currency?: string;
          payment_timing?: 'beginning_of_period' | 'end_of_period';
          rental_type?: 'short_term' | 'operational_leasing';
          rental_model?: 'rent_a_car' | 'operational_leasing' | 'financial_leasing';
          contract_duration_months?: number | null;
          early_termination_fee?: number;
          services_included?: string[];
          agreed_payment_method?: AgreedPaymentMethod;
          down_payment?: number;
          monthly_km_limit?: number | null;
          transfer_ownership?: boolean;
          early_termination_logic?: string;
          monthly_price?: number | null;
          delivery_damage_condition?: Record<string, string> | null;
          return_damage_condition?: Record<string, string> | null;
          start_fuel_percentage?: number | null;
          id?: string;
          status?: 'active' | 'completed' | 'cancelled';
          deposit_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rentals']['Insert']>;
      };
      rental_payment_schedules: {
        Row: {
          id: string;
          rental_id: string;
          company_id: string;
          due_date: string;
          amount: number;
          net_amount: number;
          tax_amount: number;
          withholding_deduction: number;
          total_payable: number;
          is_processed: boolean;
          status: 'pending' | 'invoiced' | 'paid';
          invoice_number: string | null;
          paid_at: string | null;
          payment_transaction_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rental_payment_schedules']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_processed' | 'status' | 'net_amount' | 'tax_amount' | 'withholding_deduction' | 'total_payable'> & {
          id?: string;
          is_processed?: boolean;
          status?: 'pending' | 'invoiced' | 'paid';
          net_amount?: number;
          tax_amount?: number;
          withholding_deduction?: number;
          total_payable?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rental_payment_schedules']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          type: 'income' | 'expense';
          category: string;
          description: string | null;
          amount: number;
          transaction_date: string;
          partner_id: string | null;
          vehicle_id: string | null;
          loan_id: string | null;
          rental_id: string | null;
          external_service_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      external_services: {
        Row: {
          id: string;
          service_type: 'transfer' | 'logistics' | 'car_rental';
          customer_id: string | null;
          supplier_id: string | null;
          service_date: string;
          description: string | null;
          cost: number;
          revenue: number;
          profit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['external_services']['Row'], 'id' | 'created_at' | 'updated_at' | 'profit'> & {
          id?: string;
          cost?: number;
          revenue?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['external_services']['Insert']>;
      };
      vehicle_sales: {
        Row: {
          id: string;
          vehicle_id: string;
          sale_date: string;
          sale_amount: number;
          buyer_name: string;
          notes: string | null;
          notary_document_url: string | null;
          insurance_cancelled: boolean;
          casco_cancelled: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['vehicle_sales']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vehicle_sales']['Insert']>;
      };
      partner_transactions: {
        Row: {
          id: string;
          partner_id: string;
          transaction_type: string;
          description: string;
          amount: number;
          vehicle_id: string | null;
          loan_id: string | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['partner_transactions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['partner_transactions']['Insert']>;
      };
      rental_expenses: {
        Row: {
          id: string;
          rental_id: string;
          expense_type: 'hgs' | 'traffic_fine' | 'bridge_toll' | 'damage_repair' | 'other';
          amount: number;
          expense_date: string;
          description: string | null;
          billable_to_customer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rental_expenses']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rental_expenses']['Insert']>;
      };
      accidents: {
        Row: {
          id: string;
          rental_id: string | null;
          vehicle_id: string;
          accident_date: string;
          driver_fault_rate: number;
          is_driver_alcohol_involved: boolean;
          insurance_type: 'traffic' | 'kasko' | 'none';
          repair_cost: number;
          valuation_loss: number;
          accident_report_url: string | null;
          description: string | null;
          charge_to_customer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['accidents']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['accidents']['Insert']>;
      };
      company_profiles: {
        Row: {
          id: string;
          title: string;
          legal_name: string;
          tax_office: string | null;
          tax_no: string | null;
          mersis_no: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          iban_details: string | null;
          logo_url: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['company_profiles']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_default'> & {
          id?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['company_profiles']['Insert']>;
      };
      maintenances: {
        Row: {
          id: string;
          vehicle_id: string;
          supplier_id: string | null;
          entry_date: string;
          return_date: string | null;
          current_km: number | null;
          cost: number;
          description: string | null;
          next_maintenance_km: number | null;
          service_details: ServiceDetails | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['maintenances']['Row'], 'id' | 'created_at' | 'updated_at' | 'cost' | 'service_details'> & {
          id?: string;
          cost?: number;
          service_details?: ServiceDetails | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['maintenances']['Insert']>;
      };
      partner_documents: {
        Row: {
          id: string;
          partner_id: string;
          file_name: string;
          file_url: string;
          file_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['partner_documents']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['partner_documents']['Insert']>;
      };
      notes: {
        Row: {
          id: string;
          content: string;
          color: string;
          is_public: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notes']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notes']['Insert']>;
      };
      bank_accounts: {
        Row: {
          id: string;
          company_id: string;
          bank_name: string;
          account_name: string;
          iban: string;
          currency: string;
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['bank_accounts']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_default' | 'is_active' | 'currency'> & {
          id?: string;
          currency?: string;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          company_id: string;
          customer_id: string | null;
          rental_id: string | null;
          rental_schedule_id: string | null;
          amount: number;
          currency: string;
          payment_date: string;
          payment_method: PaymentMethod;
          transaction_reference: string | null;
          bank_account_id: string | null;
          check_number: string | null;
          check_due_date: string | null;
          check_status: CheckStatus;
          check_bank_name: string | null;
          notes: string | null;
          received_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at' | 'currency' | 'payment_method' | 'check_status'> & {
          id?: string;
          currency?: string;
          payment_method?: PaymentMethod;
          check_status?: CheckStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      payment_cards: {
        Row: {
          id: string;
          company_id: string;
          customer_id: string;
          provider: PaymentProvider;
          card_token: string;
          card_alias: string | null;
          last_four_digits: string;
          card_brand: string | null;
          expiry_month: number | null;
          expiry_year: number | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payment_cards']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_default' | 'provider'> & {
          id?: string;
          provider?: PaymentProvider;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['payment_cards']['Insert']>;
      };
      payment_transactions: {
        Row: {
          id: string;
          company_id: string;
          customer_id: string | null;
          payment_id: string | null;
          payment_card_id: string | null;
          amount: number;
          currency: string;
          status: TransactionStatus;
          provider: PaymentProvider;
          provider_transaction_id: string | null;
          provider_response: Record<string, unknown> | null;
          error_code: string | null;
          error_message: string | null;
          ip_address: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payment_transactions']['Row'], 'id' | 'created_at' | 'currency' | 'status'> & {
          id?: string;
          currency?: string;
          status?: TransactionStatus;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payment_transactions']['Insert']>;
      };
      provisions: {
        Row: {
          id: string;
          rental_id: string;
          customer_id: string;
          company_id: string;
          amount: number;
          status: ProvisionStatus;
          payment_method: ProvisionPaymentMethod;
          provider_ref: string | null;
          capture_amount: number;
          release_amount: number;
          capture_reason: string | null;
          notes: string | null;
          captured_at: string | null;
          released_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['provisions']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'capture_amount' | 'release_amount'> & {
          id?: string;
          status?: ProvisionStatus;
          capture_amount?: number;
          release_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['provisions']['Insert']>;
      };
    };
  };
}

export type Partner = Database['public']['Tables']['partners']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type VehiclePartner = Database['public']['Tables']['vehicle_partners']['Row'];
export type Loan = Database['public']['Tables']['loans']['Row'];
export type LoanPayment = Database['public']['Tables']['loan_payments']['Row'];
export type Rental = Database['public']['Tables']['rentals']['Row'];
export type RentalPaymentSchedule = Database['public']['Tables']['rental_payment_schedules']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type ExternalService = Database['public']['Tables']['external_services']['Row'];
export type VehicleSale = Database['public']['Tables']['vehicle_sales']['Row'];
export type PartnerTransaction = Database['public']['Tables']['partner_transactions']['Row'];
export type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
export type RentalExpense = Database['public']['Tables']['rental_expenses']['Row'];
export type Accident = Database['public']['Tables']['accidents']['Row'];
export type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];
export type Reservation = Database['public']['Tables']['reservations']['Row'];
export type Maintenance = Database['public']['Tables']['maintenances']['Row'];
export type PartnerDocument = Database['public']['Tables']['partner_documents']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentCard = Database['public']['Tables']['payment_cards']['Row'];
export type PaymentTransaction = Database['public']['Tables']['payment_transactions']['Row'];
export type Provision = Database['public']['Tables']['provisions']['Row'];

export type OperationType = 'in_house' | 'outsourced';

export interface Driver {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  license_class: string | null;
  license_no: string | null;
  license_expiry: string | null;
  driver_photo_url: string | null;
  license_document_url: string | null;
  operation_region: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VipTransfer {
  id: string;
  company_id: string;
  customer_id: string | null;
  customer_name: string;
  vehicle_id: string | null;
  driver_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  transfer_date: string;
  transfer_time: string;
  price: number;
  status: string;
  notes: string | null;
  operation_type: OperationType;
  supplier_id: string | null;
  transfer_cost: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ActivityLog {
  id: string;
  action: 'DELETE' | 'UPDATE' | 'CREATE';
  entity: string;
  entity_id: string | null;
  details: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  company_id: string | null;
  created_at: string;
}

export type UserRole = 'super_admin' | 'admin' | 'staff' | 'user' | 'customer' | 'driver';

export interface AppUser {
  id: string;
  username: string;
  password: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  avatar_url: string | null;
  role: UserRole;
  company_id: string | null;
  linked_vehicle_ids: string[];
  assigned_rep_id: string | null;
  linked_customer_id: string | null;
  driver_license_no: string | null;
  driver_license_expiry: string | null;
  driver_type: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerDriver {
  id: string;
  customer_id: string;
  company_id: string | null;
  driver_name: string;
  driver_phone: string | null;
  driver_license_no: string | null;
  driver_license_expiry: string | null;
  notes: string | null;
  is_active: boolean;
  app_user_id: string | null;
  assigned_vehicle_id: string | null;
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
}

export type ModuleType = 'rent_a_car' | 'finance' | 'maintenance' | 'crm' | 'transfer' | 'logistics' | 'loans' | 'partners';

export interface Company {
  id: string;
  name: string;
  subscription_status: 'active' | 'suspended';
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  active_modules: ModuleType[];
  subscription_plan_id: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  owner_name: string | null;
  owner_email: string | null;
  billing_email: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  total_revenue: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_vehicles: number;
  max_users: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SystemLog {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  details: Record<string, unknown>;
  company_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type InvoiceStatus = 'Taslak' | 'Kesilmesi Bekleyen' | 'Kesildi' | 'Iptal';
export type InvoiceType = 'Kiralama Bedeli' | 'HGS Yansitma' | 'Hasar Yansitma' | 'Diger';

export interface Invoice {
  id: string;
  company_id: string;
  rental_id: string | null;
  customer_id: string;
  invoice_number: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  invoice_type: InvoiceType;
  description: string | null;
  created_at: string;
  updated_at: string;
}
