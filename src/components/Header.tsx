import { useNavigate } from "react-router-dom";
import Logo from "./Logo";

interface HeaderProps {
  onLogoClick?: () => void;
}

const Header = ({ onLogoClick }: HeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 transition-all duration-300">
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onLogoClick?.();
            navigate("/map");
          }}
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label="ELABORATOR (back to all cities)"
        >
          <Logo className="h-10 w-auto" />
        </button>

        <img
          src="/EU%20LOGO.png"
          alt="Funded by the European Union"
          className="h-10 sm:h-11 w-auto max-w-[min(55vw,280px)] object-contain opacity-[0.98] pointer-events-none drop-shadow-sm"
        />
      </div>
    </header>
  );
};

export default Header;
