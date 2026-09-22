import { supabase } from '@/integrations/supabase/client';
import { getClientsStats } from '@/lib/clients.services';

export interface MonthlyCommissionForecast {
  monthKey: string; // "2026-09"
  monthLabel: string; // "Setembro/26"
  totalForecast: number;
  approved: number; // Liberado para repasse
  pending: number; // Aguardando liquidez da parcela
  paid: number; // Já pago
  manufacturers: Array<{
    name: string;
    amount: number;
    payoutDay?: number;
  }>;
}

export interface DashboardRealStats {
  totalSales: number;
  ordersToday: number;
  totalOrders: number;
  activeClients: number;
  totalClients: number;
  pendingVisits: number;
  completedVisits: number;
  newClientsMonth: number;
  salesByPeriod: Array<{
    period: string;
    vendas: number;
    pedidos: number;
  }>;
  commissionForecast: {
    currentMonthTotal: number;
    nextMonthTotal: number;
    currentMonthApproved: number;
    currentMonthPending: number;
    currentMonthPaid: number;
    monthlyBreakdown: MonthlyCommissionForecast[];
  };
}

/**
 * Busca e agrega dados 100% reais de todas as pontas do sistema para o Dashboard.
 */
export async function getDashboardData(): Promise<DashboardRealStats> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  // 1. Clientes reais
  const clientStats = await getClientsStats();

  // 2. Pedidos reais do banco de dados
  let orders: any[] = [];
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, total_amount, created_at, status');
    if (!error && data) orders = data;
  } catch (err) {
    console.warn('Orders fetch warning:', err);
  }

  // 3. Visitas reais do banco de dados
  let visits: any[] = [];
  try {
    const { data, error } = await supabase
      .from('visits')
      .select('id, scheduled_at, status');
    if (!error && data) visits = data;
  } catch (err) {
    console.warn('Visits fetch warning:', err);
  }

  // 4. Comissões e parcelas de pedidos para previsão de recebimento
  let commissions: any[] = [];
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select(`
        id,
        commission_value,
        status,
        created_at,
        paid_at,
        manufacturer:manufacturers(name, payout_day_of_month),
        order_payment:order_payment_id(due_date, received_at)
      `);
    if (!error && data) commissions = data;
  } catch (err) {
    console.warn('Commissions fetch warning:', err);
  }

  const validOrders = orders.filter(o => o.status !== 'cancelled');
  const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const ordersToday = orders.filter(o => (o.created_at || '').startsWith(today)).length;

  const pendingVisits = visits.filter(v => v.status === 'scheduled').length;
  const completedVisits = visits.filter(v => v.status === 'completed').length;

  // 5. Histórico de vendas para o gráfico (Ano completo até o mês atual)
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const salesMap = new Map<string, { vendas: number; pedidos: number }>();

  for (let m = 0; m <= now.getMonth(); m++) {
    const label = `${monthNames[m]}/${String(now.getFullYear()).slice(-2)}`;
    salesMap.set(label, { vendas: 0, pedidos: 0 });
  }

  validOrders.forEach(o => {
    if (!o.created_at) return;
    const d = new Date(o.created_at);
    const label = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    if (salesMap.has(label)) {
      const entry = salesMap.get(label)!;
      entry.vendas += Number(o.total_amount) || 0;
      entry.pedidos += 1;
    }
  });

  const salesByPeriod = Array.from(salesMap.entries()).map(([period, data]) => ({
    period,
    vendas: data.vendas,
    pedidos: data.pedidos
  }));

  // 6. Previsão de Comissões por Mês (Mês Atual + Próximos 3 Meses)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const forecastMap = new Map<string, MonthlyCommissionForecast>();

  // Inicializa próximos 4 meses a partir do atual
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mLabel = `${fullMonthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    forecastMap.set(mKey, {
      monthKey: mKey,
      monthLabel: mLabel,
      totalForecast: 0,
      approved: 0,
      pending: 0,
      paid: 0,
      manufacturers: []
    });
  }

  commissions.forEach(c => {
    if (c.status === 'cancelled') return;
    const amount = Number(c.commission_value || c.amount) || 0;
    const mName = c.manufacturer?.name || 'Indústria';
    const payoutDay = c.manufacturer?.payout_day_of_month || 15;

    // Prioridade da data: parcela (order_payment.due_date / received_at), depois paid_at, depois created_at
    let targetDate: Date;
    if (c.order_payment?.received_at) {
      targetDate = new Date(c.order_payment.received_at);
    } else if (c.order_payment?.due_date) {
      targetDate = new Date(c.order_payment.due_date);
    } else if (c.paid_at) {
      targetDate = new Date(c.paid_at);
    } else {
      targetDate = new Date(c.created_at || new Date());
    }

    const mKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    if (forecastMap.has(mKey)) {
      const forecast = forecastMap.get(mKey)!;
      forecast.totalForecast += amount;

      if (c.status === 'paid') {
        forecast.paid += amount;
      } else if (c.status === 'approved' || c.status === 'scheduled') {
        forecast.approved += amount;
      } else {
        forecast.pending += amount;
      }

      const existingMf = forecast.manufacturers.find(m => m.name === mName);
      if (existingMf) {
        existingMf.amount += amount;
      } else {
        forecast.manufacturers.push({ name: mName, amount, payoutDay });
      }
    }
  });

  const monthlyBreakdown = Array.from(forecastMap.values());
  const currentForecast = forecastMap.get(currentMonthKey) || { totalForecast: 0, approved: 0, pending: 0, paid: 0, manufacturers: [], monthKey: '', monthLabel: '' };
  const nextForecast = forecastMap.get(nextMonthKey) || { totalForecast: 0, approved: 0, pending: 0, paid: 0, manufacturers: [], monthKey: '', monthLabel: '' };

  return {
    totalSales,
    ordersToday,
    totalOrders: orders.length,
    activeClients: clientStats.active,
    totalClients: clientStats.total,
    pendingVisits,
    completedVisits,
    newClientsMonth: clientStats.newThisMonth || 0,
    salesByPeriod,
    commissionForecast: {
      currentMonthTotal: currentForecast.totalForecast,
      nextMonthTotal: nextForecast.totalForecast,
      currentMonthApproved: currentForecast.approved,
      currentMonthPending: currentForecast.pending,
      currentMonthPaid: currentForecast.paid,
      monthlyBreakdown
    }
  };
}
