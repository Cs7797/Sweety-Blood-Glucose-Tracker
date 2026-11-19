import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppContext } from "../../context/appContext.jsx";

const Login = () => {
  const { axios, setToken, setUser, navigate } = useAppContext();
  const state = useLocation().pathname === "/register" ? "register" : "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    setError("");
    if (state === "register" && (!name.trim() || name.trim().length > 80)) {
      setError("Name must contain 1 to 80 characters");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must be at most 72 bytes");
      return;
    }
    setIsLoading(true);
    try {
      const body = state === "register" ? { name, email: email.trim(), password } : { email: email.trim(), password };
      const { data } = await axios.post(`/api/user/${state}`, body);
      localStorage.setItem("token", data.token);
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      setUser(data.user);
      setToken(data.token);
      navigate("/", { replace: true });
    } catch (error) {
      setError(error.response?.data?.message || "Unable to connect. Please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-light px-4 py-12 flex flex-col items-center justify-center">
      <Link to="/login" className="text-3xl font-semibold text-primary mb-2">Sweety</Link>
      <p className="text-gray-500 mb-8">Blood glucose tracker</p>
      <form onSubmit={onSubmitHandler} className="w-full max-w-sm bg-white border border-borderColor rounded-lg p-6 sm:p-8 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{state === "register" ? "Create account" : "Log in"}</h1>
          <p className="mt-2 text-sm text-gray-500">{state === "register" ? "Enter your details to get started." : "Enter your details to view your readings."}</p>
        </div>
        {state === "register" && (
          <div>
            <label htmlFor="name" className="text-sm">Name</label>
            <input id="name" type="text" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 mt-1 border border-borderColor rounded-md" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="text-sm">Email</label>
          <input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 mt-1 border border-borderColor rounded-md" />
        </div>
        <div>
          <label htmlFor="password" className="text-sm">Password</label>
          <input id="password" type="password" autoComplete={state === "register" ? "new-password" : "current-password"} required minLength={state === "register" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={state === "register" ? "password-help" : undefined} className="w-full px-3 py-2.5 mt-1 border border-borderColor rounded-md" />
          {state === "register" && <p id="password-help" className="text-sm text-gray-500 mt-2">Use at least 8 characters, up to 72 bytes.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={isLoading} className="w-full py-2.5 bg-primary hover:bg-primary-dull text-white rounded-md">{isLoading ? "Please wait…" : state === "register" ? "Create account" : "Log in"}</button>
        <p className="text-sm text-gray-500">
          {state === "register" ? "Already have an account? " : "Don't have an account? "}
          <Link to={state === "register" ? "/login" : "/register"} className="text-primary hover:underline">{state === "register" ? "Log in" : "Create account"}</Link>
        </p>
      </form>
    </main>
  );
};

export default Login;
