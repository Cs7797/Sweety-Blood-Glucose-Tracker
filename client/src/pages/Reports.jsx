import { lazy, Suspense, useEffect, useState } from "react";
import { useAppContext } from "../../context/appContext.jsx";
import Title from "../components/Title.jsx";
import { formatDate, getToday } from "../utils/dates.js";

const MonthlyTrend = lazy(() => import("../components/MonthlyTrend.jsx"));

const Reports = () => {
  const { axios } = useAppContext();
  const [type, setType] = useState("daily");
  const [date, setDate] = useState(getToday);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const fetchReport = async () => {
      setIsLoading(true);
      setError("");
      setReport(null);
      try {
        const { data } = await axios.get(`/api/reports/${type}`, {
          params: { date },
          signal: controller.signal,
        });
        setReport(data.report);
      } catch (error) {
        if (!axios.isCancel(error)) setError(error.response?.data?.message || "Unable to load report. Please try again");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchReport();
    return () => controller.abort();
  }, [type, date, refresh]);

  const cards = report ? [
    { title: "Minimum", value: report.min ?? "—", unit: "mg/dL" },
    { title: "Maximum", value: report.max ?? "—", unit: "mg/dL" },
    { title: "Average", value: report.average === null ? "—" : report.average.toFixed(1), unit: "mg/dL" },
    { title: "Reading count", value: report.count, unit: report.count === 1 ? "reading" : "readings" },
  ] : [];

  return (
    <>
      <Title title="Reports" subtitle="Review your glucose readings for a day or month." />
      <div className="flex flex-wrap items-end gap-5 mt-8">
        <div className="w-full sm:w-60">
          <label htmlFor="report-type" className="block text-sm mb-1">Report period</label>
          <select id="report-type" value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-white border border-borderColor rounded-md px-3 py-2.5">
            <option value="daily">Daily</option>
            <option value="month-to-date">Month to date</option>
            <option value="previous-month">Previous month</option>
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="report-date" className="block text-sm mb-1">Report date</label>
          <input id="report-date" type="date" required min="0001-01-01" max={getToday()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-borderColor rounded-md px-3 py-2.5" />
        </div>
      </div>
      {isLoading ? <p role="status" className="py-8 text-gray-500">Loading report…</p> : error ? (
        <div className="mt-6 p-5 border border-borderColor rounded-md"><p role="alert" className="text-red-700">{error}</p><button onClick={() => setRefresh((value) => value + 1)} className="text-primary mt-3 hover:underline">Try again</button></div>
      ) : report && (
        <section aria-label="Glucose report" className="mt-8">
          <h2 className="font-medium text-gray-900">{formatDate(report.startDate)}{report.startDate !== report.endDate && ` – ${formatDate(report.endDate)}`}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {cards.map((card) => (
              <div key={card.title} className="border border-borderColor rounded-md p-4 sm:p-5">
                <h3 className="text-sm text-gray-500">{card.title}</h3>
                <p className="text-2xl font-semibold text-gray-900 mt-3">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.unit}</p>
              </div>
            ))}
          </div>
          {report.count === 0 ? (
            <div className="mt-6 border border-borderColor rounded-md p-6">
              <p className="font-medium">No readings for this period.</p>
              <p className="text-gray-500 mt-2">Choose another date or add a reading from the Readings page.</p>
            </div>
          ) : type === "daily" ? (
            <div className="mt-6 border border-borderColor rounded-md overflow-hidden">
              <h3 className="px-4 sm:px-5 py-4 bg-light font-medium text-gray-900">Daily readings</h3>
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 border-t border-borderColor"><tr><th scope="col" className="p-4 font-medium">Time slot</th><th scope="col" className="p-4 font-medium">Glucose (mg/dL)</th></tr></thead>
                <tbody>{report.readings.map((reading) => <tr key={reading.id} className="border-t border-borderColor"><td className="p-4">{reading.slot}</td><td className="p-4 font-medium text-gray-900">{reading.glucose}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <Suspense fallback={<p role="status" className="py-6 text-gray-500">Loading chart…</p>}>
              <MonthlyTrend trend={report.trend} />
            </Suspense>
          )}
          <p className="text-sm text-gray-500 mt-5">Average is rounded to one decimal place. Report dates use India Standard Time.</p>
        </section>
      )}
    </>
  );
};

export default Reports;
