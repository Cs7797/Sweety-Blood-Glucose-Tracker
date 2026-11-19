import { Link } from "react-router-dom";
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
    </header>
  );
};

export default Navbar;
