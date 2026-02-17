/**
 * ?????????????dashboard_items ?????
 * API ? YourMEMO/YourTopics/????? ???
 */
export interface DashboardItem {
  id: number
  user_id: number
  dashboard_date: string
  entry_type: number  // 1=Point(MEMO), 2=Task(Topic), 3=Target
  subject: number | null
  item: string
  due_date: string | null
  status: number  // Point: 1=??,2=??,3=??,4=??? / Task: 1=??,2=???,3=??,4=??
  memo: string | null
  position: number
  favorite: number  // 0=OFF, 1=ON
  created_at: string
  updated_at: string
  deleted_at: string | null
}
