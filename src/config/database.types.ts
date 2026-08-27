export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          after: Json | null;
          before: Json | null;
          id: string;
          org_id: string;
          performed_by: string;
          reconciliation_summary: Json | null;
          reload_amount: number | null;
          timestamp: number;
          transaction_id: string;
          transaction_title: string;
        };
        Insert: {
          action: string;
          after?: Json | null;
          before?: Json | null;
          id?: string;
          org_id: string;
          performed_by: string;
          reconciliation_summary?: Json | null;
          reload_amount?: number | null;
          timestamp: number;
          transaction_id: string;
          transaction_title: string;
        };
        Update: {
          action?: string;
          after?: Json | null;
          before?: Json | null;
          id?: string;
          org_id?: string;
          performed_by?: string;
          reconciliation_summary?: Json | null;
          reload_amount?: number | null;
          timestamp?: number;
          transaction_id?: string;
          transaction_title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_task_requirements: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          key: string;
          label: string;
          org_id: string;
          task_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          key: string;
          label: string;
          org_id: string;
          task_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          key?: string;
          label?: string;
          org_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_task_requirements_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'financial_task_requirements_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'financial_tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_tasks: {
        Row: {
          assignee_email: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          due_date: string;
          id: string;
          is_individual_vendor: boolean;
          org_id: string;
          payment_type: string | null;
          title: string;
        };
        Insert: {
          assignee_email?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_date: string;
          id?: string;
          is_individual_vendor?: boolean;
          org_id: string;
          payment_type?: string | null;
          title: string;
        };
        Update: {
          assignee_email?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_date?: string;
          id?: string;
          is_individual_vendor?: boolean;
          org_id?: string;
          payment_type?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_tasks_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          budget_allocations: Json;
          debit_card_account_number: string | null;
          debit_card_icn: string | null;
          debit_card_last_four: string | null;
          debit_card_load_balance: number | null;
          debit_card_project_id: string | null;
          id: string;
          is_budget_lines_set: boolean;
          last_reconciliation_date: number | null;
          name: string;
          officers: string[];
          sofo_approvers: string[];
        };
        Insert: {
          budget_allocations?: Json;
          debit_card_account_number?: string | null;
          debit_card_icn?: string | null;
          debit_card_last_four?: string | null;
          debit_card_load_balance?: number | null;
          debit_card_project_id?: string | null;
          id?: string;
          is_budget_lines_set?: boolean;
          last_reconciliation_date?: number | null;
          name: string;
          officers?: string[];
          sofo_approvers?: string[];
        };
        Update: {
          budget_allocations?: Json;
          debit_card_account_number?: string | null;
          debit_card_icn?: string | null;
          debit_card_last_four?: string | null;
          debit_card_load_balance?: number | null;
          debit_card_project_id?: string | null;
          id?: string;
          is_budget_lines_set?: boolean;
          last_reconciliation_date?: number | null;
          name?: string;
          officers?: string[];
          sofo_approvers?: string[];
        };
        Relationships: [];
      };
      pending_changes: {
        Row: {
          after: Json | null;
          before: Json;
          id: string;
          org_id: string;
          requested_at: number;
          requested_by: string;
          transaction_id: string;
          transaction_title: string;
          type: string;
        };
        Insert: {
          after?: Json | null;
          before: Json;
          id?: string;
          org_id: string;
          requested_at: number;
          requested_by: string;
          transaction_id: string;
          transaction_title: string;
          type: string;
        };
        Update: {
          after?: Json | null;
          before?: Json;
          id?: string;
          org_id?: string;
          requested_at?: number;
          requested_by?: string;
          transaction_id?: string;
          transaction_title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pending_changes_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pending_changes_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      people: {
        Row: {
          email: string;
          name: string;
        };
        Insert: {
          email: string;
          name: string;
        };
        Update: {
          email?: string;
          name?: string;
        };
        Relationships: [];
      };
      reload_requests: {
        Row: {
          amount: number;
          id: string;
          org_id: string;
          reconciled_total: number;
          requested_at: number;
          requested_by: string;
          transaction_count: number;
        };
        Insert: {
          amount: number;
          id?: string;
          org_id: string;
          reconciled_total: number;
          requested_at: number;
          requested_by: string;
          transaction_count: number;
        };
        Update: {
          amount?: number;
          id?: string;
          org_id?: string;
          reconciled_total?: number;
          requested_at?: number;
          requested_by?: string;
          transaction_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'reload_requests_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          amount: number;
          budget_line: string;
          conflict_of_interest_acknowledged_missing: boolean | null;
          conflict_of_interest_file_url: string | null;
          contract_acknowledged_missing: boolean | null;
          contract_file_url: string | null;
          contracted_services_acknowledged_missing: boolean | null;
          contracted_services_file_url: string | null;
          date: string | null;
          direction: string;
          exemption_form_url: string | null;
          funding: string | null;
          id: string;
          is_individual_vendor: boolean | null;
          is_northwestern_employee: boolean | null;
          no_receipt_acknowledged: boolean | null;
          notes: string;
          org_id: string;
          payment_status: string | null;
          receipt_file_url: string | null;
          reconciled_at: number | null;
          reimbursed_member_name: string | null;
          special_pay_form_acknowledged_missing: boolean | null;
          special_pay_form_url: string | null;
          tax_amount: number | null;
          tax_exempt_form_submitted: boolean | null;
          tax_reimbursed: boolean | null;
          title: string;
          type: string;
          upload_tokens: Json;
          w9_acknowledged_missing: boolean | null;
          w9_file_url: string | null;
          zelle_info: string | null;
        };
        Insert: {
          amount: number;
          budget_line: string;
          conflict_of_interest_acknowledged_missing?: boolean | null;
          conflict_of_interest_file_url?: string | null;
          contract_acknowledged_missing?: boolean | null;
          contract_file_url?: string | null;
          contracted_services_acknowledged_missing?: boolean | null;
          contracted_services_file_url?: string | null;
          date?: string | null;
          direction: string;
          exemption_form_url?: string | null;
          funding?: string | null;
          id?: string;
          is_individual_vendor?: boolean | null;
          is_northwestern_employee?: boolean | null;
          no_receipt_acknowledged?: boolean | null;
          notes?: string;
          org_id: string;
          payment_status?: string | null;
          receipt_file_url?: string | null;
          reconciled_at?: number | null;
          reimbursed_member_name?: string | null;
          special_pay_form_acknowledged_missing?: boolean | null;
          special_pay_form_url?: string | null;
          tax_amount?: number | null;
          tax_exempt_form_submitted?: boolean | null;
          tax_reimbursed?: boolean | null;
          title: string;
          type: string;
          upload_tokens?: Json;
          w9_acknowledged_missing?: boolean | null;
          w9_file_url?: string | null;
          zelle_info?: string | null;
        };
        Update: {
          amount?: number;
          budget_line?: string;
          conflict_of_interest_acknowledged_missing?: boolean | null;
          conflict_of_interest_file_url?: string | null;
          contract_acknowledged_missing?: boolean | null;
          contract_file_url?: string | null;
          contracted_services_acknowledged_missing?: boolean | null;
          contracted_services_file_url?: string | null;
          date?: string | null;
          direction?: string;
          exemption_form_url?: string | null;
          funding?: string | null;
          id?: string;
          is_individual_vendor?: boolean | null;
          is_northwestern_employee?: boolean | null;
          no_receipt_acknowledged?: boolean | null;
          notes?: string;
          org_id?: string;
          payment_status?: string | null;
          receipt_file_url?: string | null;
          reconciled_at?: number | null;
          reimbursed_member_name?: string | null;
          special_pay_form_acknowledged_missing?: boolean | null;
          special_pay_form_url?: string | null;
          tax_amount?: number | null;
          tax_exempt_form_submitted?: boolean | null;
          tax_reimbursed?: boolean | null;
          title?: string;
          type?: string;
          upload_tokens?: Json;
          w9_acknowledged_missing?: boolean | null;
          w9_file_url?: string | null;
          zelle_info?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_transaction_upload_tokens: {
        Args: { p_org_id: string; p_tokens: Json; p_transaction_id: string };
        Returns: undefined;
      };
      apply_budget_delta: {
        Args: { p_delta: number; p_line: string; p_org_id: string };
        Returns: undefined;
      };
      apply_transaction_edit: {
        Args: { p_after: Json; p_org_id: string; p_transaction_id: string };
        Returns: {
          amount: number;
          budget_line: string;
          conflict_of_interest_acknowledged_missing: boolean | null;
          conflict_of_interest_file_url: string | null;
          contract_acknowledged_missing: boolean | null;
          contract_file_url: string | null;
          contracted_services_acknowledged_missing: boolean | null;
          contracted_services_file_url: string | null;
          date: string | null;
          direction: string;
          exemption_form_url: string | null;
          funding: string | null;
          id: string;
          is_individual_vendor: boolean | null;
          is_northwestern_employee: boolean | null;
          no_receipt_acknowledged: boolean | null;
          notes: string;
          org_id: string;
          payment_status: string | null;
          receipt_file_url: string | null;
          reconciled_at: number | null;
          reimbursed_member_name: string | null;
          special_pay_form_acknowledged_missing: boolean | null;
          special_pay_form_url: string | null;
          tax_amount: number | null;
          tax_exempt_form_submitted: boolean | null;
          tax_reimbursed: boolean | null;
          title: string;
          type: string;
          upload_tokens: Json;
          w9_acknowledged_missing: boolean | null;
          w9_file_url: string | null;
          zelle_info: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'transactions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      can_manage_org: { Args: { p_org_id: string }; Returns: boolean };
      cancel_pending_change_with_audit: {
        Args: { p_org_id: string; p_pending_id: string };
        Returns: undefined;
      };
      create_transaction_with_audit: {
        Args: {
          p_org_id: string;
          p_transaction: Json;
          p_transaction_id: string;
          p_upload_tokens?: Json;
        };
        Returns: undefined;
      };
      current_email: { Args: never; Returns: string };
      get_transaction_title: {
        Args: { p_org_id: string; p_transaction_id: string };
        Returns: string;
      };
      is_org_member: { Args: { p_org_id: string }; Returns: boolean };
      is_org_member_by_org_id_text: {
        Args: { p_org_id_text: string };
        Returns: boolean;
      };
      is_wildcatledger_allowed_email: {
        Args: { v_email: string };
        Returns: boolean;
      };
      ledger_now_ms: { Args: never; Returns: number };
      mark_tax_reimbursed_with_audit: {
        Args: { p_org_id: string; p_transaction_id: string };
        Returns: undefined;
      };
      reconcile_transactions_with_audit: {
        Args: { p_org_id: string; p_transaction_ids: string[] };
        Returns: undefined;
      };
      request_reload_with_audit: {
        Args: {
          p_amount: number;
          p_org_id: string;
          p_reconciled_total: number;
          p_transaction_count: number;
        };
        Returns: undefined;
      };
      request_transaction_change_with_audit: {
        Args: {
          p_after?: Json;
          p_org_id: string;
          p_transaction_id: string;
          p_type: string;
        };
        Returns: undefined;
      };
      require_org_manager: { Args: { p_org_id: string }; Returns: undefined };
      require_org_member: { Args: { p_org_id: string }; Returns: undefined };
      resolve_pending_change_with_audit: {
        Args: { p_approved: boolean; p_org_id: string; p_pending_id: string };
        Returns: undefined;
      };
      restrict_login_to_northwestern_email: {
        Args: { event: Json };
        Returns: Json;
      };
      restrict_signup_to_northwestern_email: {
        Args: { event: Json };
        Returns: Json;
      };
      submit_document_upload: {
        Args: {
          p_field: string;
          p_org_id: string;
          p_token: string;
          p_transaction_id: string;
          p_url: string;
        };
        Returns: undefined;
      };
      transaction_audit_json: {
        Args: {
          p_transaction: Database['public']['Tables']['transactions']['Row'];
        };
        Returns: Json;
      };
      transaction_counts_toward_balance: {
        Args: {
          p_transaction: Database['public']['Tables']['transactions']['Row'];
        };
        Returns: boolean;
      };
      transaction_edit_requires_approval: {
        Args: {
          p_after: Json;
          p_before: Database['public']['Tables']['transactions']['Row'];
        };
        Returns: boolean;
      };
      transaction_signed_amount: {
        Args: {
          p_transaction: Database['public']['Tables']['transactions']['Row'];
        };
        Returns: number;
      };
      update_payment_status_with_audit: {
        Args: { p_org_id: string; p_status: string; p_transaction_id: string };
        Returns: undefined;
      };
      write_ledger_audit: {
        Args: {
          p_action: string;
          p_after?: Json;
          p_before?: Json;
          p_org_id: string;
          p_reconciliation_summary?: Json;
          p_reload_amount?: number;
          p_transaction_id: string;
          p_transaction_title: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
