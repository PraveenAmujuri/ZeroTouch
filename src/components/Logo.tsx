import React from 'react';
import pathsData from './zerotouch_paths_clean.json';

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  fill?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  fill = 'currentColor',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={pathsData.viewBox}
      className={`inline-block shrink-0 select-none ${className}`}
      aria-label="0Touch"
      role="img"
      {...props}
    >
      {pathsData.letters.map((letter, idx) => (
        <path
          key={idx}
          d={letter.d}
          fill={fill}
          fillRule="evenodd"
        />
      ))}
    </svg>
  );
};

export default Logo;
