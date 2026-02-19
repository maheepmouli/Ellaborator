interface LogoProps {
  className?: string;
}

const Logo = ({ className = "h-10" }: LogoProps) => {
  return (
    <img 
      src="/Elaborator Logo RGB - Colour 1 - Inverted.png" 
      alt="ELABORATOR" 
      className={`${className} w-auto`}
    />
  );
};

export default Logo;
