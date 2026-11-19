import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "../utils/dates.js";

const MonthlyTrend = ({ trend }) => {
  return (
    <section aria-labelledby="trend-title" className="mt-6 border border-borderColor rounded-md p-4 sm:p-6 min-w-0">
      <h3 id="trend-title" className="font-medium text-gray-900">Monthly glucose trend</h3>
      <p className="text-sm text-gray-500 mt-2">Daily average in mg/dL. Days without readings are left blank.</p>
      <div className="h-72 mt-6 w-full" role="group" aria-label="Daily average glucose chart. Exact values are available in the table below.">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={trend} margin={{ top: 10, right: 12, bottom: 10, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" tickFormatter={(value) => String(Number(value.slice(8)))} tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <YAxis domain={[0, "auto"]} width={44} tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <Tooltip labelFormatter={formatDate} formatter={(value) => [`${Number(value).toFixed(1)} mg/dL`, "Daily average"]} contentStyle={{ borderColor: "#c4c7d2", borderRadius: 6, fontSize: 14 }} />
            <Line type="linear" dataKey="average" name="Daily average" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-gray-500 mt-2 text-center">Day of month</p>
      <details className="mt-5 border-t border-borderColor pt-4">
        <summary className="text-sm text-primary cursor-pointer w-fit">View daily averages</summary>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500"><tr><th scope="col" className="py-3 pr-4 font-medium">Date</th><th scope="col" className="py-3 pr-4 font-medium">Average (mg/dL)</th><th scope="col" className="py-3 font-medium">Readings</th></tr></thead>
            <tbody>{trend.filter((day) => day.count > 0).map((day) => <tr key={day.date} className="border-t border-borderColor"><td className="py-3 pr-4 whitespace-nowrap">{formatDate(day.date)}</td><td className="py-3 pr-4">{day.average.toFixed(1)}</td><td className="py-3">{day.count}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
  );
};

export default MonthlyTrend;
