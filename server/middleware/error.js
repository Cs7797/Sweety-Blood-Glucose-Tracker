const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Request body must contain valid JSON" });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large" });
  }

  if (error.status === 415) {
    return res.status(415).json({ success: false, message: "Request encoding is not supported" });
  }

  if (error.status === 400) {
    return res.status(400).json({ success: false, message: "Request body is invalid" });
  }

  return res.status(500).json({ success: false, message: "Something went wrong. Please try again" });
};

export default errorHandler;
