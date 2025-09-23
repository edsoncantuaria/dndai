// components/Icons.tsx
import React from 'react';

const SVGIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5"
    {...props}
  >
    {props.children}
  </svg>
);

export const Icons = {
  Spinner: ({ className = '' }: { className?: string }) => (
    <svg className={`animate-spin h-5 w-5 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ),
  Shield: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 1.5A1.5 1.5 0 0111.5 0h.055a1.5 1.5 0 01.434.093l.39.156c.33.132.63.333.886.588l.39.391a1.5 1.5 0 01.343.513L14 3.55v.055a1.5 1.5 0 01-.093.434l-.156.39c-.132.33-.333.63-.588.886l-.391.39a1.5 1.5 0 01-.513.343L10.45 6h-.055a1.5 1.5 0 01-.434-.093l-.39-.156a1.99 1.99 0 01-.886-.588l-.39-.391a1.5 1.5 0 01-.343-.513L8 3.55v-.055a1.5 1.5 0 01.093.434l.156-.39c.132-.33.333-.63.588-.886l.391-.39a1.5 1.5 0 01.513-.343L9.55 1.5h.055A1.5 1.5 0 0110 1.5zM8.5 7.5a.5.5 0 01.5.5v2.75a.5.5 0 01-1 0V8a.5.5 0 01.5-.5z" clipRule="evenodd" /></SVGIcon>,
  Heart: (props: any) => <SVGIcon {...props}><path d="M10 3.22l-.61-.6a5.5 5.5 0 00-7.78 7.78L10 18.78l8.39-8.4a5.5 5.5 0 00-7.78-7.78L10 3.22z" /></SVGIcon>,
  Magic: (props: any) => <SVGIcon {...props}><path d="M9.05 3.29a.75.75 0 01.9 0l.59.59c.05.05.1.1.16.14l.3.2a.75.75 0 010 1.1l-.5.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 010-1.06l.5-.5a.75.75 0 011.1 0l.2.3c.05.05.1.1.14.16l.59.59zM10.5 6a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /></SVGIcon>,
  Backpack: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2-1a1 1 0 00-1 1v1.5a.5.5 0 01-1 0V5a2 2 0 012-2h8a2 2 0 012 2v1.5a.5.5 0 01-1 0V5a1 1 0 00-1-1H6z" clipRule="evenodd" /></SVGIcon>,
  User: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></SVGIcon>,
  Book: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 014.75 2h5.5A2.75 2.75 0 0113 4.75v10.5A2.75 2.75 0 0110.25 18h-5.5A2.75 2.75 0 012 15.25V4.75zM4.75 3.5a1.25 1.25 0 00-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h5.5c.69 0 1.25-.56 1.25-1.25V4.75c0-.69-.56-1.25-1.25-1.25h-5.5z" clipRule="evenodd" /></SVGIcon>,
  TrendingUp: (props: any) => <SVGIcon {...props}><path d="M12.5 5.5a.5.5 0 01.5.5v6.5a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zM8.5 8.5a.5.5 0 01.5.5v3.5a.5.5 0 01-1 0V9a.5.5 0 01.5-.5zM4.5 11.5a.5.5 0 01.5.5v.5a.5.5 0 01-1 0v-.5a.5.5 0 01.5-.5z" /></SVGIcon>,
  Minus: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M5 10a.5.5 0 01.5-.5h9a.5.5 0 010 1H5.5A.5.5 0 015 10z" clipRule="evenodd" /></SVGIcon>,
  Plus: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 5a.5.5 0 01.5.5v4h4a.5.5 0 010 1h-4v4a.5.5 0 01-1 0v-4h-4a.5.5 0 010-1h4v-4A.5.5 0 0110 5z" clipRule="evenodd" /></SVGIcon>,
  InformationCircle: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></SVGIcon>,
  AlertTriangle: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10.25 1.75a.75.75 0 00-1.5 0v.165c-2.222.95-3.83 3.12-3.83 5.585v3.628a2.5 2.5 0 00.999 1.984l.115.08a.75.75 0 10.872-1.21l-.115-.08a1 1 0 01-.4-1.272c.483-.847 1.48-1.42 2.588-1.42h.016c1.108 0 2.105.573 2.588 1.42a1 1 0 01-.4 1.272l-.115.08a.75.75 0 10.872 1.21l.115-.08a2.5 2.5 0 001-1.984V7.5c0-2.465-1.608-4.635-3.83-5.585V1.75zM10 18a.75.75 0 000-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></SVGIcon>,
  ChevronDown: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" /></SVGIcon>,
  Users: (props: any) => <SVGIcon {...props}><path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM11.5 9.5A3.5 3.5 0 108 6a3.5 3.5 0 003.5 3.5zM14 12a1 1 0 10-2 0 1 1 0 002 0zM11 12a1 1 0 10-2 0 1 1 0 002 0zM8 12a1 1 0 10-2 0 1 1 0 002 0zM5 12a1 1 0 10-2 0 1 1 0 002 0zM3.5 13a1.5 1.5 0 00-1.5 1.5v2.5A1.5 1.5 0 003.5 18h13a1.5 1.5 0 001.5-1.5v-2.5A1.5 1.5 0 0016.5 13h-13z" /></SVGIcon>,
  Map: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10.25 1.75a.75.75 0 00-1.5 0V2a1 1 0 00-1 1v1.25a.75.75 0 001.5 0V3a1 1 0 001-1V1.75zM8.5 4.25a.75.75 0 00-1.5 0v1.5a.75.75 0 001.5 0v-1.5zM6 4a.5.5 0 01.5-.5h.75a.75.75 0 000-1.5H6.5A2 2 0 004.5 4v10.5A1.5 1.5 0 006 16h8.5a1.5 1.5 0 001.5-1.5V6.5A2 2 0 0014 4.5h-.75a.75.75 0 000 1.5H14a.5.5 0 01.5.5v8a.5.5 0 01-.5-.5H6a.5.5 0 01-.5-.5V4z" clipRule="evenodd" /></SVGIcon>,
  Thought: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 2.5c-4.14 0-7.5 2.91-7.5 6.5s3.36 6.5 7.5 6.5c.83 0 1.63-.12 2.38-.34a.75.75 0 01.82.32l1.12 1.68a.75.75 0 001.2-.8l-1.2-2.16a.75.75 0 01.1-.92 4.8 4.8 0 001.1-3.28c0-3.59-3.36-6.5-7.5-6.5zM8.5 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm4.5 1.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" clipRule="evenodd" /></SVGIcon>,
  Sword: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M6.53 3.47a.75.75 0 011.06 0l9 9a.75.75 0 010 1.06l-2.25 2.25a.75.75 0 01-1.06 0l-9-9a.75.75 0 010-1.06l2.25-2.25zM4.75 14.5a.75.75 0 001.06 0l9-9a.75.75 0 00-1.06-1.06l-9 9a.75.75 0 000 1.06z" clipRule="evenodd" /></SVGIcon>,
  BookOpen: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.373c.33.085.643.22.928.396V4.25A2.75 2.75 0 009.25 1.5h-5.5A2.75 2.75 0 001 4.25v10.5A2.75 2.75 0 003.75 17.5h5.5A2.75 2.75 0 0012 14.75V13.5a1 1 0 112 0v1.25a4.75 4.75 0 01-4.75 4.75h-5.5A4.75 4.75 0 01-1 14.75V4.25A4.75 4.75 0 013.75-.5h5.5A4.75 4.75 0 0114 4.25V6a1 1 0 11-2 0V4.25a2.75 2.75 0 00-2.75-2.75H10V2zm0 13a1 1 0 01-1-1v-1.25c.356-.166.688-.38 1-.635V14a1 1 0 01-1 1zm-1-4.873a1 1 0 010-1.254l.002-.002a1 1 0 011.254 0l.002.002a1 1 0 010 1.254l-.002.002a1 1 0 01-1.254 0l-.002-.002z" clipRule="evenodd"/></SVGIcon>,
  Hand: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M9 6.5a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v3.25a.75.75 0 001.5 0V6.5a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v3.25a.75.75 0 001.5 0V8a.5.5 0 01.5-.5h.5a.5.5 0 01.5.5v2.25a2.25 2.25 0 01-2.25 2.25V15a2.5 2.5 0 01-5 0v-2.25A2.25 2.25 0 016 10.5V5a2 2 0 012-2h1a2 2 0 012 2v1.5a.5.5 0 01-1 0V5a1 1 0 00-1-1H8a1 1 0 00-1 1v5.5a1.25 1.25 0 001.25 1.25H9v-3.25z" clipRule="evenodd" /></SVGIcon>,
  Target: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zm0-4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></SVGIcon>,
  Moon: (props: any) => <SVGIcon {...props}><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></SVGIcon>,
  Play: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></SVGIcon>,
  Upload: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></SVGIcon>,
  PlusCircle: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></SVGIcon>,
  Sparkles: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M10 2.5a.75.75 0 01.75.75v1.25a.75.75 0 01-1.5 0V3.25A.75.75 0 0110 2.5zM10 15.5a.75.75 0 01.75.75v1.25a.75.75 0 01-1.5 0V16.25a.75.75 0 01.75-.75zM3.25 10a.75.75 0 01.75-.75h1.25a.75.75 0 010 1.5H4a.75.75 0 01-.75-.75zM15.5 10a.75.75 0 01.75-.75h1.25a.75.75 0 010 1.5H16.25a.75.75 0 01-.75-.75zM5.47 5.47a.75.75 0 011.06 0l.88.88a.75.75 0 01-1.06 1.06l-.88-.88a.75.75 0 010-1.06zM13.59 13.59a.75.75 0 011.06 0l.88.88a.75.75 0 01-1.06 1.06l-.88-.88a.75.75 0 010-1.06zM14.53 5.47a.75.75 0 010 1.06l-.88.88a.75.75 0 01-1.06-1.06l.88-.88a.75.75 0 011.06 0zM6.53 13.59a.75.75 0 010 1.06l-.88.88a.75.75 0 01-1.06-1.06l.88-.88a.75.75 0 011.06 0z" clipRule="evenodd" /></SVGIcon>,
  Dice: (props: any) => <SVGIcon {...props}><path fillRule="evenodd" d="M3.5 2.75a.75.75 0 00-1.5 0V15A2.75 2.75 0 004.75 17.75h10.5A2.75 2.75 0 0018 15V2.75a.75.75 0 00-1.5 0V15a1.25 1.25 0 01-1.25 1.25H4.75A1.25 1.25 0 013.5 15V2.75zM6 6.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5-1.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-5 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clipRule="evenodd" /></SVGIcon>,
};
