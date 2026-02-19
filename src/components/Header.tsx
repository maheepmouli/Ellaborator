import { Link } from "react-router-dom";
import Logo from "./Logo";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 transition-all duration-300">
      <div className="px-4 py-3">
        <Link to="/map" className="flex items-center transition-opacity hover:opacity-80">
          <Logo className="h-10 w-auto" />
        </Link>
      </div>
    </header>
  );
};

export default Header;
