const getToday = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const validateDate = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "0001-01-01") {
    return "Enter a valid date in YYYY-MM-DD format";
  }

  const value = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    return "Enter a valid calendar date";
  }

  if (date > getToday()) {
    return "Date cannot be in the future";
  }

  return null;
};

export { getToday, validateDate };
