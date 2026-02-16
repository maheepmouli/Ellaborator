import elaboratorLogo from "@/assets/elaborator-logo-new.png";

interface LogoProps {
  className?: string;
}

const Logo = ({ className = "h-10" }: LogoProps) => {
  return (
    <img 
      src={elaboratorLogo} 
      alt="ELABORATOR" 
      className={`${className} w-auto`}
    />
  );
};

export default Logo;
