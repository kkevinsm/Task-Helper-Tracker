export type OrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "revision"
  | "revision_completed"
  | "cancelled";

/** Full row — only visible to admins (RLS). */
export type Order = {
  id: string;
  tracking_code: string;
  client_name: string;
  client_contact: string | null;
  title: string;
  category: string;
  status: OrderStatus;
  deadline: string | null;
  notes: string | null;
  admin_notes: string | null;
  price: number | null;
  result_file_path: string | null;
  result_file_name: string | null;
  result_link: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Shape returned by the `get_public_order` RPC (name already masked). */
export type PublicOrder = {
  tracking_code: string;
  client_name: string;
  title: string;
  category: string;
  status: OrderStatus;
  deadline: string | null;
  notes: string | null;
  has_file: boolean;
  result_file_name: string | null;
  result_link: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

