export type AppRole = "admin" | "gestor_comercial" | "supervisor" | "representante";

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  avatar_path?: string;
  phone?: string;
  status: "active" | "inactive";
  last_access?: string;
  created_at: string;
  updated_at: string;
  role?: AppRole;
}

export interface Region {
  id: string;
  name: string;
  state: string;
  cities: string[];
  status: "active" | "inactive";
  created_at: string;
}

export interface Representative {
  id: string;
  user_id: string;
  region_id?: string;
  code?: string;
  cpf?: string;
  birth_date?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  commission_rate: number;
  monthly_goal: number;
  start_date?: string;
  status: "active" | "inactive";
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  photo_url?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual / Join
  region?: Region;
  profile?: UserProfile;
}

export type ClientStatus = "prospect" | "active" | "inactive" | "blocked";
export type PurchasePotential = "alto" | "medio" | "baixo";

export interface Client {
  id: string;
  representative_id: string;
  region_id?: string;
  name: string; // Nome Fantasia
  legal_name?: string; // Razão Social
  trade_name?: string; // Nome Fantasia (aliás de name)
  cnpj?: string;
  state_registration?: string;
  segment?: string;
  client_type?: string;
  status: ClientStatus;

  // Contato principal
  contact_name?: string;
  contact_role?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;

  // Endereço
  address?: string;
  address_number?: string;
  address_complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;

  // Localização
  latitude?: number;
  longitude?: number;

  // Comercial
  purchase_potential?: PurchasePotential;
  notes?: string;

  // Auditoria
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  representative?: Representative;
  region?: Region;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  notes?: string;
  is_main: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientTransferHistory {
  id: string;
  client_id: string;
  previous_representative_id?: string;
  new_representative_id?: string;
  transferred_by: string;
  reason?: string;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  trade_name?: string;
  code?: string;
  description?: string;
  category_id?: string;
  subcategory?: string;
  manufacturer_id?: string;
  brand?: string;
  unit?: string;
  price: number;
  min_price?: number;
  commission_rate?: number;
  status: "active" | "inactive";
  main_image_url?: string;
  commercial_notes?: string;
  technical_specifications?: any;
  applications?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  category?: ProductCategory;
}

export interface ProductMaterial {
  id: string;
  product_id: string;
  name: string;
  file_url: string;
  file_type?: "image" | "pdf" | "catalog" | "technical_sheet";
  created_at: string;
}

export interface ProductHistory {
  id: string;
  product_id: string;
  user_id?: string;
  action: string;
  changes?: any;
  created_at: string;
}

export type OrderStatus =
  "draft" | "sent" | "analysis" | "approved" | "invoiced" | "delivered" | "cancelled";

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  representative_id: string;
  opportunity_id?: string;
  status: OrderStatus;

  // Financials
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;

  // Commercial Conditions
  payment_method?: string;
  payment_condition?: string;
  payment_term?: string;
  expected_delivery_date?: string;

  // Observations
  commercial_notes?: string;
  internal_notes?: string;
  billing_notes?: string;
  purchase_order_number?: string;
  cancellation_reason?: string;
  rejection_reason?: string;

  // Metadata
  origin: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  client?: Client;
  representative?: Representative;
  opportunity?: Opportunity;
  items?: OrderItem[];
  history?: OrderHistory[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  created_at: string;

  // Virtual
  product?: Product;
}

export interface OrderHistory {
  id: string;
  order_id: string;
  user_id?: string;
  action: string;
  previous_status?: OrderStatus;
  new_status?: OrderStatus;
  details?: any;
  created_at: string;
}

export interface VisitNote {
  id: string;
  visit_id: string;
  author_id?: string;
  author_name?: string;
  content: string;
  tags?: string[];
  next_steps?: string;
  created_at: string;
}

export interface Visit {
  id: string;
  client_id: string;
  representative_id: string;
  scheduled_at: string;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
  notebook?: string; // Caderno de anotações da visita
  meeting_summary?: string; // Resumo do que foi conversado
  agreements?: string; // Acordos e próximos passos
  created_at: string;

  // Virtual
  client?: Client;
  representative?: Representative;
  visit_notes?: VisitNote[];
}

export interface CRMStage {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sort_order: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export type OpportunityStatus = "open" | "won" | "lost";
export type OpportunityOrigin =
  | "Prospecção"
  | "Indicação"
  | "Visita"
  | "WhatsApp"
  | "Telefone"
  | "Site"
  | "Cliente atual"
  | "Outro";
export type LossReason =
  | "Preço"
  | "Concorrência"
  | "Prazo"
  | "Cliente desistiu"
  | "Produto inadequado"
  | "Sem orçamento"
  | "Sem retorno"
  | "Outro";

export interface Opportunity {
  id: string;
  representative_id: string;
  client_id: string;
  stage_id: string;
  title: string;
  description?: string;
  estimated_value: number;
  probability: number;
  origin: OpportunityOrigin;
  expected_closing_date?: string;
  actual_closing_date?: string;
  loss_reason?: LossReason;
  loss_notes?: string;
  next_action_description?: string;
  next_action_date?: string;
  status: OpportunityStatus;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  client?: Client;
  representative?: Representative;
  stage?: CRMStage;
  items?: OpportunityItem[];
  activities?: OpportunityActivity[];
}

export interface OpportunityItem {
  id: string;
  opportunity_id: string;
  product_id: string;
  quantity: number;
  estimated_price: number;
  discount_percent: number;
  total_value: number;
  created_at: string;

  // Virtual
  product?: Product;
}

export type OpportunityActivityType =
  "Ligação" | "WhatsApp" | "E-mail" | "Reunião" | "Visita" | "Follow-up" | "Tarefa";
export type OpportunityActivityStatus = "pending" | "completed" | "cancelled" | "overdue";

export interface OpportunityActivity {
  id: string;
  opportunity_id: string;
  representative_id: string;
  type: OpportunityActivityType;
  description: string;
  scheduled_at: string;
  completed_at?: string;
  status: OpportunityActivityStatus;
  created_at: string;
}

export interface OpportunityHistory {
  id: string;
  opportunity_id: string;
  user_id?: string;
  action: string;
  previous_stage_id?: string;
  new_stage_id?: string;
  previous_value?: number;
  new_value?: number;
  details?: any;
  created_at: string;
}

export interface FollowUp {
  id: string;
  representative_id: string;
  client_id: string;
  description: string;
  scheduled_at: string;
  status: string;
}

export type GoalType = "monthly" | "quarterly" | "semiannual" | "annual";
export type GoalStatus = "active" | "closed" | "cancelled";

export interface Goal {
  id: string;
  representative_id: string;
  period: string;
  type: GoalType;
  target_value: number;
  achieved_value: number;
  status: GoalStatus;
  observations?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  representative?: Representative;
}

export interface CommissionRule {
  id: string;
  name: string;
  representative_id?: string;
  category_id?: string;
  manufacturer_id?: string;
  product_id?: string;
  commission_rate: number;
  valid_from?: string;
  valid_until?: string;
  status: "active" | "inactive";
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  representative?: Representative;
  category?: ProductCategory;
  product?: Product;
}

export type CommissionStatus = "pending" | "approved" | "scheduled" | "paid" | "cancelled";

export type CommissionPaymentTrigger = "liquidity" | "invoicing" | "custom";

export interface Manufacturer {
  id: string;
  name: string;
  legal_name?: string;
  logo_path?: string | null;
  trade_name?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  responsible_name?: string;
  commission_rate?: number;
  default_commission_rate?: number;
  payout_day_of_month?: number; // Dia fixo do repasse no mês subsequente (ex: 15 Nutriex, 25 Libus)
  commission_trigger?: CommissionPaymentTrigger;
  commission_days_after_payment?: number;
  contact_info?: any;
  observations?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  installment_number: number;
  due_date: string;
  value: number;
  received_value: number;
  status: "pending" | "paid" | "overdue" | "cancelled";
  received_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  order_id: string;
  representative_id: string;
  order_payment_id?: string;
  manufacturer_id?: string;
  rule_id?: string;
  settlement_key?: string;
  base_value: number;
  commission_rate: number;
  commission_value: number;
  status: CommissionStatus;
  expected_payment_date?: string;
  payment_date?: string;
  payment_value?: number;
  payment_method?: string;
  payment_notes?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  order?: Order;
  representative?: Representative;
  rule?: CommissionRule;
  manufacturer?: Manufacturer;
  payment?: OrderPayment;
}

export interface CommissionHistory {
  id: string;
  commission_id?: string;
  goal_id?: string;
  user_id?: string;
  action: string;
  details?: any;
  created_at: string;
}

export type MaterialCategory =
  | "Catálogos"
  | "Fichas técnicas"
  | "Apresentações"
  | "Tabelas comerciais"
  | "Imagens"
  | "Vídeos"
  | "Campanhas"
  | "Materiais de treinamento"
  | "Outros";

export type MaterialStatus = "active" | "inactive";

export interface CommercialMaterial {
  id: string;
  name: string;
  description?: string;
  category: MaterialCategory;
  product_id?: string;
  product_category_id?: string;
  status: MaterialStatus;
  file_url: string;
  file_type?: string;
  file_size?: number;
  cover_image_url?: string;
  observations?: string;
  usage_count: number;
  share_count: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Virtual
  product?: Product;
  product_category?: ProductCategory;
}

export interface MaterialHistory {
  id: string;
  material_id: string;
  user_id?: string;
  action: string;
  details?: any;
  created_at: string;
}

export type NotificationType =
  "visita" | "follow_up" | "oportunidade" | "pedido" | "meta" | "comissao" | "cliente" | "sistema";
export type NotificationPriority = "informativa" | "atencao" | "importante" | "urgente";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  related_record_id?: string;
  related_record_type?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface UserNotificationSetting {
  id: string;
  user_id: string;
  category: NotificationType;
  enabled: boolean;
  is_mandatory: boolean;
}

export interface RouteStatusType {
  status: RouteStatus;
}

export type RouteStatus = "planejada" | "em_andamento" | "concluida" | "cancelada";
export type RouteStopStatus =
  "pendente" | "em_deslocamento" | "em_visita" | "concluida" | "pulada" | "cancelada";

export interface Route {
  id: string;
  representative_id: string;
  name: string;
  date: string;
  status: RouteStatus;
  total_distance_km?: number;
  total_duration_min?: number;
  origin_type?: "my_location" | "address" | "company" | "first_client";
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_type?: "last_client" | "company" | "custom_address" | "none";
  destination_address?: string;
  destination_lat?: number;
  destination_lng?: number;
  created_at: string;
  updated_at: string;

  // Virtual
  stops?: RouteStop[];
}

export interface RouteStop {
  id: string;
  route_id: string;
  client_id?: string;
  visit_id?: string;
  sequence_order: number;
  status: RouteStopStatus;
  label?: string;
  latitude: number;
  longitude: number;
  distance_from_previous_km?: number;
  duration_from_previous_min?: number;
  scheduled_time?: string;
  estimated_duration_min?: number;
  created_at: string;
  updated_at: string;

  // Virtual
  client?: Client;
  visit?: Visit;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: any;
  created_at: string;

  // Virtual
  profiles?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface CompanySettings {
  id: string;
  company_name: string;
  legal_name?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  logo_url?: string;
  logo_docs_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  updated_at: string;
}

export interface SystemPreferences {
  id: string;
  date_format: string;
  currency_code: string;
  timezone: string;
  default_pagination: number;
  language: string;
  updated_at: string;
}
