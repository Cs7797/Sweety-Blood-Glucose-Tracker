import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/appContext.jsx";
import Title from "../components/Title.jsx";
import ReadingForm from "../components/ReadingForm.jsx";
import { formatDate, getToday } from "../utils/dates.js";

const Dashboard = () => {
  const { axios } = useAppContext();
  const [date, setDate] = useState(getToday);
  const [readings, setReadings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [reading, setReading] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  useEffect(() => {
    const controller = new AbortController();
    const fetchReadings = async () => {
      setIsLoading(true);
      setError("");
      try {
        const { data } = await axios.get("/api/readings", {
          params: { page, limit: 10, ...(date ? { date } : {}) },
          signal: controller.signal,
        });
        if (page > 1 && page > data.pagination.totalPages) {
          setPage(Math.max(1, data.pagination.totalPages));
          return;
        }
        setReadings(data.readings);
        setPagination(data.pagination);
      } catch (error) {
        if (!axios.isCancel(error)) setError(error.response?.data?.message || "Unable to load readings. Please try again");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchReadings();
    return () => controller.abort();
  }, [date, page, refresh]);

  const deleteReading = async (id) => {
    if (deleteId || !window.confirm("Delete this reading? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const { data } = await axios.delete(`/api/readings/${id}`);
      toast.success(data.message);
      setRefresh((value) => value + 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete reading. Please try again");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <Title title="Readings" subtitle="Record and review your daily blood glucose readings." />
        <button onClick={() => { setReading(null); setShowForm(true); }} disabled={showForm} className="px-5 py-2.5 bg-primary hover:bg-primary-dull text-white rounded-md">Add reading</button>
      </div>
      {showForm && <ReadingForm key={reading?.id || "new"} reading={reading} date={date} onCancel={() => setShowForm(false)} onSave={(saved) => { setShowForm(false); setDate(saved.date); setPage(1); setRefresh((value) => value + 1); }} />}
      <div className="flex flex-wrap items-end gap-3 mt-8">
        <div>
          <label htmlFor="filter-date" className="block text-sm mb-1">Reading date</label>
          <input id="filter-date" type="date" min="0001-01-01" max={getToday()} value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} className="border border-borderColor rounded-md px-3 py-2" />
        </div>
        <button onClick={() => { setDate(getToday()); setPage(1); }} className="border border-borderColor rounded-md px-4 py-2 hover:bg-light">Today</button>
        <button onClick={() => { setDate(""); setPage(1); }} className={`border rounded-md px-4 py-2 ${date ? "border-borderColor hover:bg-light" : "border-primary text-primary bg-primary/5"}`}>All dates</button>
      </div>
      <section aria-label="Reading history" className="mt-5 border border-borderColor rounded-md overflow-hidden">
        <div className="px-4 sm:px-5 py-4 bg-light flex flex-wrap justify-between gap-2">
          <h2 className="font-medium text-gray-900">{date ? formatDate(date) : "All readings"}</h2>
          {!isLoading && !error && <p className="text-sm text-gray-500">{pagination.total} {pagination.total === 1 ? "reading" : "readings"}</p>}
        </div>
        {isLoading ? <p role="status" className="p-6 text-gray-500">Loading readings…</p> : error ? (
          <div className="p-6"><p role="alert" className="text-red-700">{error}</p><button onClick={() => setRefresh((value) => value + 1)} className="text-primary mt-3 hover:underline">Try again</button></div>
        ) : readings.length === 0 ? (
          <div className="p-6"><p className="font-medium">No readings for {date ? "this date" : "your account"}.</p><p className="text-gray-500 mt-2">Use Add reading to record your glucose level.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-140">
              <thead className="text-gray-500 border-t border-borderColor"><tr><th scope="col" className="p-4 font-medium">Date</th><th scope="col" className="p-4 font-medium">Time slot</th><th scope="col" className="p-4 font-medium">Glucose (mg/dL)</th><th scope="col" className="p-4 font-medium">Actions</th></tr></thead>
              <tbody>
                {readings.map((item) => (
                  <tr key={item.id} className="border-t border-borderColor">
                    <td className="p-4 whitespace-nowrap">{formatDate(item.date)}</td>
                    <td className="p-4">{item.slot}</td>
                    <td className="p-4 font-medium text-gray-900">{item.glucose}</td>
                    <td className="p-4"><div className="flex gap-4">
                      <button disabled={showForm || deleteId !== null} onClick={() => { setReading(item); setShowForm(true); }} aria-label={`Edit ${item.slot} on ${formatDate(item.date)}`} className="text-primary hover:underline">Edit</button>
                      <button disabled={showForm || deleteId !== null} onClick={() => deleteReading(item.id)} aria-label={`Delete ${item.slot} on ${formatDate(item.date)}`} className="text-red-700 hover:underline">{deleteId === item.id ? "Deleting…" : "Delete"}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!error && pagination.total > 0 && (
        <nav aria-label="Reading pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p aria-live="polite" className="text-gray-500">Page {page} of {Math.max(1, pagination.totalPages)}</p>
          <div className="flex gap-3">
            <button onClick={() => setPage((value) => value - 1)} disabled={isLoading || showForm || deleteId !== null || page === 1} className="px-4 py-2 border border-borderColor rounded-md hover:bg-light">Previous</button>
            <button onClick={() => setPage((value) => value + 1)} disabled={isLoading || showForm || deleteId !== null || page >= pagination.totalPages} className="px-4 py-2 border border-borderColor rounded-md hover:bg-light">Next</button>
          </div>
        </nav>
      )}
      <p className="text-sm text-gray-500 mt-4">Dates use India Standard Time. Glucose values are recorded in mg/dL.</p>
    </>
  );
};

export default Dashboard;
