"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type HourlyPoint = {
  hour: number;
  label: string;
  total: number;
  transactions: number;
};

export type DayOfWeekPoint = {
  dayName: string;
  dayIndex: number;
  total: number;
  transactions: number;
  hourlyBreakdown: HourlyPoint[];
};

export type ProductPoint = {
  name: string;
  total: number;
  quantity: number;
  cost?: number;
  profit?: number;
  margin?: number;
};

export type PaymentPoint = {
  method: string;
  total: number;
  transactions: number;
};

export type StaffPoint = {
  name: string;
  sales: number;
  transactions: number;
  discountGiven: number;
  cost?: number;
  profit?: number;
  margin?: number;
};

const TooltipContent = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          {p.name === "Sales (RM)" ? `RM ${p.value.toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
};

export function SalesBarChart({ data }: { data: HourlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f0f0f0"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          yAxisId="sales"
          orientation="left"
          tickFormatter={(v) => `RM${v}`}
          tick={{ fontSize: 11 }}
          width={60}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={{ fontSize: 11 }}
          width={36}
        />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ paddingTop: 56, fontSize: 12 }} />
        <Bar
          yAxisId="sales"
          dataKey="total"
          name="Sales (RM)"
          fill="#4f46e5"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          yAxisId="count"
          dataKey="transactions"
          name="Transactions"
          fill="#a5b4fc"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesLineChart({ data }: { data: HourlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => `RM${v}`}
          tick={{ fontSize: 11 }}
          width={60}
        />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ paddingTop: 56, fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="total"
          name="Sales (RM)"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProductSalesBarChart({ data }: { data: ProductPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="#f0f0f0"
        />
        <XAxis
          type="number"
          tickFormatter={(v) => `RM${v}`}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          width={180}
        />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="total"
          name="Sales (RM)"
          fill="#4f46e5"
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentTypeBarChart({ data }: { data: PaymentPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f0f0f0"
        />
        <XAxis dataKey="method" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="sales"
          orientation="left"
          tickFormatter={(v) => `RM${v}`}
          tick={{ fontSize: 11 }}
          width={60}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={{ fontSize: 11 }}
          width={36}
        />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="sales"
          dataKey="total"
          name="Sales (RM)"
          fill="#4f46e5"
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
        />
        <Bar
          yAxisId="count"
          dataKey="transactions"
          name="Transactions"
          fill="#a5b4fc"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StaffSalesBarChart({ data }: { data: StaffPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 120, bottom: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="#f0f0f0"
        />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          width={110}
        />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="sales"
          name="Sales (RM)"
          fill="#4f46e5"
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesByDayOfWeekChart({ data }: { data: DayOfWeekPoint[] }) {
  const aggregatedData = data.map((day) => ({
    name: day.dayName,
    total: day.total,
    transactions: day.transactions,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={aggregatedData}
        margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f0f0f0"
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<TooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="total"
          name="Sales (RM)"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DayOfWeekTrendCharts({ data }: { data: DayOfWeekPoint[] }) {
  const START_HOUR = 10; // 10 AM
  const END_HOUR = 23; // 11 PM (so 11 PM - 12 AM is included)

  // Filter and enrich data to show only operation hours (10 AM - 12 AM)
  const enrichedData = data.map((day) => {
    const hourMap = new Map(day.hourlyBreakdown.map((h) => [h.hour, h]));
    const operationHours: HourlyPoint[] = [];

    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      if (hourMap.has(hour)) {
        operationHours.push(hourMap.get(hour)!);
      } else {
        operationHours.push({
          hour,
          label: formatRangeLabel(hour),
          total: 0,
          transactions: 0,
        });
      }
    }

    return { ...day, hourlyBreakdown: operationHours };
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {enrichedData.map((day) => (
        <div
          key={day.dayName}
          className="rounded-lg border bg-white p-3 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-900 mb-2 text-center">
            {day.dayName}
          </h3>
          <div className="text-xs text-gray-600 text-center mb-2">
            <div>RM {day.total.toFixed(2)}</div>
            <div className="text-gray-500">{day.transactions} txn</div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart
              data={day.hourlyBreakdown}
              margin={{ top: 4, right: 4, left: -20, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8 }}
                interval={1}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 9 }} width={30} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  padding: "6px",
                  fontSize: "11px",
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                dot={false}
                isAnimationActive={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

// Helper function to format hour range labels
function formatRangeLabel(hour: number) {
  const start = hour.toString().padStart(2, "0");
  const end = ((hour + 1) % 24).toString().padStart(2, "0");
  return `${start}:00-${end}:00`;
}
