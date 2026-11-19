import { Link, NavLink } from "react-router-dom";
import { useAppContext } from "../../context/appContext.jsx";

const Navbar = () => {
  const { user, logout } = useAppContext();
  return (
    <header className="border-b border-borderColor">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="text-2xl font-semibold text-primary">Sweety</Link>
        <div className="flex items-center gap-4 md:gap-6 text-sm">
          <span className="hidden sm:block max-w-48 truncate">{user.name}</span>
          <button onClick={logout} className="px-4 py-2 border border-borderColor rounded-md hover:bg-light">Log out</button>
        </div>
      </div>
      <nav aria-label="Main navigation" className="max-w-6xl mx-auto px-4 md:px-8 flex gap-6 text-sm">
        {[{ path: "/", name: "Readings" }, { path: "/account", name: "Account" }].map((link) => (
          <NavLink key={link.path} to={link.path} end className={({ isActive }) => `py-3 border-b-2 ${isActive ? "border-primary text-primary font-medium" : "border-transparent text-gray-500 hover:text-gray-900"}`}>{link.name}</NavLink>
        ))}
      </nav>
    </header>
  );
};

export default Navbar;
