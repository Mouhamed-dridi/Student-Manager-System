import { useEffect, useState } from "react";
import {
  CalendarCheck,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import CustomizeWidgetsDialog from "@/components/dashboard/CustomizeWidgetsDialog";
import { DashboardWidgetStat } from "@/components/dashboard/DashboardWidgets";
import PersonalizeDashboardButton from "@/components/dashboard/PersonalizeDashboardButton";
import { errorMessage, getDashboardStats, type DashboardStats } from "@/lib/api";
import {
  dashboardWidgetsKey,
  loadWidgetPrefs,
  saveWidgetPrefs,
  widgetStatGridClass,
} from "@/lib/dashboardWidgets";
import { cn } from "@/lib/utils";
import {
  OPERATOR_WIDGETS,
  type OperatorWidgetPrefs,
} from "./dashboardWidgets";

const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

const OPERATOR_KEY = dashboardWidgetsKey("operator");

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which cards/charts are visible; persisted per browser (src/lib/dashboardWidgets.ts).
  const [widgets, setWidgets] = useState<OperatorWidgetPrefs>(() =>
    loadWidgetPrefs(OPERATOR_KEY, OPERATOR_WIDGETS),
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDashboardStats()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <DataError message={error} />;
  if (!stats)
    return <DataLoading label="Loading dashboard…" />;

  const kpiCount = [
    widgets.activeStudents,
    widgets.teachers,
    widgets.attendanceRate,
    widgets.revenueThisMonth,
  ].filter(Boolean).length;
  const bothRevenueCharts =
    widgets.revenuePaidChart && widgets.revenuePlanChart;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <PersonalizeDashboardButton onClick={() => setCustomizeOpen(true)} />
      </div>

      {kpiCount > 0 && (
        <div className={cn("grid gap-4", widgetStatGridClass(kpiCount))}>
          {widgets.activeStudents && (
            <DashboardWidgetStat
              icon={Users}
              label="Active Students"
              value={String(stats.studentCount)}
              hint="Students available for login"
            />
          )}
          {widgets.teachers && (
            <DashboardWidgetStat
              icon={GraduationCap}
              label="Teachers"
              value={String(stats.teacherCount)}
              hint="Active teaching staff"
            />
          )}
          {widgets.attendanceRate && (
            <DashboardWidgetStat
              icon={CalendarCheck}
              label="Attendance Rate"
              value={`${stats.attendanceRate.toFixed(1)}%`}
              hint="Presence density, last 30 days"
            />
          )}
          {widgets.revenueThisMonth && (
            <DashboardWidgetStat
              icon={Wallet}
              label="Revenue This Month"
              value={formatCurrency(stats.monthlyRevenue)}
              hint={`${formatCurrency(stats.pendingAmount)} pending`}
            />
          )}
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          bothRevenueCharts && "lg:grid-cols-2",
        )}
      >
        {widgets.revenuePaidChart && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Revenue — Paid (6 months)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={stats.revenueByMonth}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.15}
                  />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.revenuePlanChart && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by Plan</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {stats.revenueByPlan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No paid payments yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.revenueByPlan}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      label
                    >
                      {stats.revenueByPlan.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        <Card className={cn(bothRevenueCharts && "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="text-base">Students by Program</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {stats.studentsByProgram.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No enrolled students yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.studentsByProgram}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.15}
                  />
                  <XAxis dataKey="program" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Students"
                    fill={CHART_COLORS[0]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomizeWidgetsDialog
        open={customizeOpen}
        widgets={OPERATOR_WIDGETS}
        preferences={widgets}
        onOpenChange={setCustomizeOpen}
        onSave={(next) => {
          setWidgets(next);
          saveWidgetPrefs(OPERATOR_KEY, next);
        }}
      />
    </div>
  );
}
