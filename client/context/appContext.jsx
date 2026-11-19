import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

export const appContext = createContext();

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common.Authorization;
    setToken(null);
    setUser(null);
    setError("");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      setIsLoading(true);
      setError("");
      try {
        const { data } = await axios.get("/api/user/data", { signal: controller.signal });
        setUser(data.user);
      } catch (error) {
        if (axios.isCancel(error)) return;
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          delete axios.defaults.headers.common.Authorization;
          setToken(null);
          setUser(null);
        } else {
          setError(error.response?.data?.message || "Unable to connect. Please try again");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchUser();
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && localStorage.getItem("token")) logout();
        return Promise.reject(error);
      },
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const value = { axios, navigate, token, setToken, user, setUser, isLoading, error, logout };
  return <appContext.Provider value={value}>{children}</appContext.Provider>;
};

export const useAppContext = () => {
  return useContext(appContext);
};
