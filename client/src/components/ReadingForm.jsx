import { useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/appContext.jsx";
import { slots } from "../assets/assets.js";
import { getToday } from "../utils/dates.js";

const ReadingForm = ({ reading, date, onSave, onCancel }) => {
  const { axios } = useAppContext();
  const [value, setValue] = useState({
    date: reading?.date || date || getToday(),
    slot: reading?.slot || "",
    glucose: reading?.glucose ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    setError("");
    const day = new Date(`${value.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || value.date < "0001-01-01" || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value.date || value.date > getToday()) {
      setError("Select a valid date that is not in the future");
      return;
    }
    if (!slots.includes(value.slot)) {
      setError("Select a time slot");
      return;
    }
    const glucose = Number(value.glucose);
    if (String(value.glucose).trim() === "" || !Number.isInteger(glucose) || glucose < 40 || glucose > 600) {
      setError("Glucose must be a whole number from 40 to 600 mg/dL");
      return;
    }
    setIsLoading(true);
    try {
      const body = { ...value, glucose };
      const { data } = reading
        ? await axios.put(`/api/readings/${reading.id}`, body)
        : await axios.post("/api/readings", body);
      toast.success(data.message);
      onSave(data.reading);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to save reading. Please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section aria-labelledby="reading-form-title" className="mt-6 p-4 sm:p-6 border border-borderColor rounded-md bg-white">
      <h2 id="reading-form-title" className="text-lg font-medium text-gray-900">{reading ? "Edit reading" : "Add reading"}</h2>
      <form onSubmit={onSubmitHandler} className="mt-5">
        <fieldset disabled={isLoading} className="grid sm:grid-cols-3 gap-5">
          <div>
            <label htmlFor="reading-date" className="text-sm">Date</label>
            <input id="reading-date" type="date" required min="0001-01-01" max={getToday()} value={value.date} onChange={(e) => setValue({ ...value, date: e.target.value })} className="w-full px-3 py-2.5 mt-1 border border-borderColor rounded-md" />
          </div>
          <div>
            <label htmlFor="reading-slot" className="text-sm">Time slot</label>
            <select id="reading-slot" required value={value.slot} onChange={(e) => setValue({ ...value, slot: e.target.value })} className="w-full px-3 py-2.5 mt-1 border border-borderColor rounded-md bg-white">
              <option value="">Select a time slot</option>
              {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="reading-glucose" className="text-sm">Glucose (mg/dL)</label>
            <input id="reading-glucose" type="number" inputMode="numeric" required min="40" max="600" step="1" value={value.glucose} onChange={(e) => setValue({ ...value, glucose: e.target.value })} aria-describedby="glucose-help" className="w-full px-3 py-2.5 mt-1 border border-borderColor rounded-md" />
          </div>
        </fieldset>
        <p id="glucose-help" className="text-sm text-gray-500 mt-3">Enter a whole number from 40–600 mg/dL. One reading per time slot each day.</p>
        {error && <p role="alert" className="text-sm text-red-700 mt-4">{error}</p>}
        <div className="flex flex-wrap gap-3 mt-5">
          <button disabled={isLoading} className="px-5 py-2.5 bg-primary hover:bg-primary-dull text-white rounded-md">{isLoading ? "Saving…" : "Save reading"}</button>
          <button type="button" onClick={onCancel} disabled={isLoading} className="px-5 py-2.5 border border-borderColor rounded-md hover:bg-light">Cancel</button>
        </div>
      </form>
    </section>
  );
};

export default ReadingForm;
