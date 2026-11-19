import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { appContext } from "../context/appContext.jsx";
import ReadingForm from "../src/components/ReadingForm.jsx";

let axios;
let onSave;
let onCancel;

beforeEach(() => {
  axios = { post: mock.fn(), put: mock.fn() };
  onSave = mock.fn();
  onCancel = mock.fn();
  mock.method(toast, "success", () => {});
});

afterEach(() => {
  cleanup();
  mock.restoreAll();
});

const renderForm = (props = {}) => {
  render(
    <appContext.Provider value={{ axios }}>
      <ReadingForm date="2025-01-01" onSave={onSave} onCancel={onCancel} {...props} />
    </appContext.Provider>,
  );
};

test("new readings show the selected date and the four assignment slots", () => {
  renderForm();
  assert.equal(screen.getByLabelText("Date").value, "2025-01-01");
  assert.equal(screen.getByLabelText("Glucose (mg/dL)").value, "");
  assert.deepEqual(screen.getAllByRole("option").slice(1).map((option) => option.value), [
    "Morning (fasting)", "After breakfast", "After lunch", "After dinner",
  ]);
});

test("adding a reading sends numeric glucose and returns the saved reading", async () => {
  const reading = { id: 1, date: "2025-01-01", slot: "Morning (fasting)", glucose: 110.5 };
  axios.post = mock.fn(async () => ({ data: { reading, message: "Reading added" } }));
  renderForm();

  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "Morning (fasting)" } });
  fireEvent.change(screen.getByLabelText("Glucose (mg/dL)"), { target: { value: "110.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));

  await waitFor(() => assert.equal(onSave.mock.callCount(), 1));
  assert.deepEqual(axios.post.mock.calls[0].arguments, ["/api/readings", { date: "2025-01-01", slot: "Morning (fasting)", glucose: 110.5 }]);
  assert.deepEqual(onSave.mock.calls[0].arguments, [reading]);
  assert.equal(axios.put.mock.callCount(), 0);
});

test("editing a reading prefills its values and updates its API endpoint", async () => {
  const reading = { id: 7, date: "2025-01-02", slot: "After lunch", glucose: 140 };
  const saved = { ...reading, glucose: 145.25 };
  axios.put = mock.fn(async () => ({ data: { reading: saved, message: "Reading updated" } }));
  renderForm({ reading });
  assert.equal(screen.getByLabelText("Date").value, reading.date);
  assert.equal(screen.getByLabelText("Time slot").value, reading.slot);
  assert.equal(screen.getByLabelText("Glucose (mg/dL)").value, "140");

  fireEvent.change(screen.getByLabelText("Glucose (mg/dL)"), { target: { value: "145.25" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));

  await waitFor(() => assert.equal(onSave.mock.callCount(), 1));
  assert.deepEqual(axios.put.mock.calls[0].arguments, ["/api/readings/7", { date: reading.date, slot: reading.slot, glucose: 145.25 }]);
  assert.deepEqual(onSave.mock.calls[0].arguments, [saved]);
  assert.equal(axios.post.mock.callCount(), 0);
});

test("required fields prevent an empty reading from being submitted", () => {
  renderForm();
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));

  assert.equal(screen.getByLabelText("Time slot").validity.valueMissing, true);
  assert.equal(screen.getByLabelText("Glucose (mg/dL)").validity.valueMissing, true);
  assert.equal(axios.post.mock.callCount(), 0);
  assert.equal(onSave.mock.callCount(), 0);
});

test("glucose values below 40 or above 600 cannot be submitted", () => {
  renderForm();
  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "After breakfast" } });
  const glucose = screen.getByLabelText("Glucose (mg/dL)");

  fireEvent.change(glucose, { target: { value: "39" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  assert.equal(glucose.validity.rangeUnderflow, true);

  fireEvent.change(glucose, { target: { value: "601" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  assert.equal(glucose.validity.rangeOverflow, true);
  assert.equal(axios.post.mock.callCount(), 0);
});

test("future dates cannot be submitted", () => {
  renderForm();
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "9999-12-31" } });
  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "After dinner" } });
  fireEvent.change(screen.getByLabelText("Glucose (mg/dL)"), { target: { value: "110" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));

  assert.equal(screen.getByLabelText("Date").validity.rangeOverflow, true);
  assert.equal(axios.post.mock.callCount(), 0);
});

test("glucose values of exactly 40 and 600 can be saved", async () => {
  axios.post = mock.fn(async (_path, reading) => ({ data: { reading: { id: 1, ...reading }, message: "Reading added" } }));
  renderForm();
  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "Morning (fasting)" } });
  const glucose = screen.getByLabelText("Glucose (mg/dL)");

  fireEvent.change(glucose, { target: { value: "40" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(() => assert.equal(onSave.mock.callCount(), 1));
  assert.equal(axios.post.mock.calls[0].arguments[1].glucose, 40);

  fireEvent.change(glucose, { target: { value: "600" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(() => assert.equal(onSave.mock.callCount(), 2));
  assert.equal(axios.post.mock.calls[1].arguments[1].glucose, 600);
});

test("a duplicate slot error is shown without losing the entered glucose", async () => {
  const message = "A reading already exists for this date and time slot";
  axios.post = mock.fn(async () => { throw { response: { data: { message } } }; });
  renderForm();
  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "Morning (fasting)" } });
  fireEvent.change(screen.getByLabelText("Glucose (mg/dL)"), { target: { value: "110" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));

  assert.equal((await screen.findByRole("alert")).textContent, message);
  assert.equal(screen.getByLabelText("Glucose (mg/dL)").value, "110");
  assert.equal(screen.getByRole("button", { name: "Save reading" }).disabled, false);
  assert.equal(onSave.mock.callCount(), 0);
});

test("a network failure shows a useful error instead of calling onSave", async () => {
  axios.post = mock.fn(async () => { throw new Error("Network Error"); });
  renderForm();
  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "After lunch" } });
  fireEvent.change(screen.getByLabelText("Glucose (mg/dL)"), { target: { value: "120" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));

  assert.equal((await screen.findByRole("alert")).textContent, "Unable to save reading. Please try again");
  assert.equal(onSave.mock.callCount(), 0);
});

test("save and cancel stay disabled while a reading is being saved", async () => {
  let finishSave;
  axios.post = mock.fn(() => new Promise((resolve) => { finishSave = resolve; }));
  renderForm();
  fireEvent.change(screen.getByLabelText("Time slot"), { target: { value: "After dinner" } });
  fireEvent.change(screen.getByLabelText("Glucose (mg/dL)"), { target: { value: "120" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reading" }));
  assert.equal(screen.getByRole("button", { name: "Saving…" }).disabled, true);
  assert.equal(screen.getByRole("button", { name: "Cancel" }).disabled, true);
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  assert.equal(axios.post.mock.callCount(), 1);

  await act(async () => {
    finishSave({ data: { reading: { id: 1 }, message: "Reading added" } });
  });
  assert.equal(screen.getByRole("button", { name: "Save reading" }).disabled, false);
});

test("cancel calls onCancel without sending an API request", () => {
  renderForm();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  assert.equal(onCancel.mock.callCount(), 1);
  assert.equal(axios.post.mock.callCount(), 0);
  assert.equal(axios.put.mock.callCount(), 0);
});
